<?php

namespace App\Http\Controllers;

use App\Actions\Invitations\AcceptTeacherInvitation;
use App\Actions\Invitations\InviteTeacher;
use App\Actions\Memberships\ManageTeachers;
use App\Actions\Memberships\RecordMembershipAudit;
use App\Actions\Memberships\RevokeMembershipAccess;
use App\Actions\Memberships\RevokeTeacher;
use App\Actions\Memberships\TransferOwnership;
use App\Models\ChurchMembership;
use App\Models\Invitation;
use App\Policies\ChurchMembershipPolicy;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;

final class TeacherManagementController extends Controller
{
    private function input(Request $request, array $rules): array
    {
        abort_if(array_diff(array_keys($request->all()), array_keys($rules)) !== [] || $request->allFiles() !== [], 422);

        return $request->validate($rules);
    }

    private function owner(Request $request): string
    {
        abort_unless((new ChurchMembershipPolicy)->manage($request->user()), 403);

        return app(TenantContext::class)->churchId();
    }

    private function ministryRules(): array
    {
        return ['ministry_ids' => ['present', 'array', 'max:100'], 'ministry_ids.*' => ['required', 'uuid', 'distinct']];
    }

    public function index(Request $request)
    {
        $churchId = $this->owner($request);
        $page = $this->input($request, ['page' => ['sometimes', 'integer', 'min:1']])['page'] ?? 1;
        $rows = ChurchMembership::where('church_id', $churchId)->where('role', 'teacher')->with('user:id,name')->orderBy('id')->offset(($page - 1) * 50)->limit(51)->get();
        $data = $rows->take(50)->map(fn ($row) => [
            'id' => $row->id, 'display_name' => $row->user->name, 'status' => $row->status,
            'ministry_ids' => DB::table('teacher_ministry_assignments')->where('church_id', $churchId)->where('membership_id', $row->id)->whereNull('revoked_at')->pluck('ministry_id')->all(),
            'can_manage' => $row->status === 'active',
        ]);

        return response()->json(['data' => $data, 'has_more' => $rows->count() > 50, 'can_invite' => true]);
    }

    public function invitations(Request $request)
    {
        $churchId = $this->owner($request);
        $page = $this->input($request, ['page' => ['sometimes', 'integer', 'min:1']])['page'] ?? 1;
        $rows = Invitation::where('church_id', $churchId)->orderByDesc('created_at')->orderBy('id')->offset(($page - 1) * 50)->limit(51)->get();

        return response()->json(['data' => $rows->take(50)->map(fn ($row) => $row->projection()), 'has_more' => $rows->count() > 50]);
    }

    public function invite(Request $request, InviteTeacher $action)
    {
        $this->owner($request);
        $request->merge(['email' => is_string($request->input('email')) ? mb_strtolower(trim($request->input('email'))) : $request->input('email')]);
        $input = $this->input($request, ['email' => ['required', 'email:rfc', 'max:254']] + $this->ministryRules());
        abort_if($input['ministry_ids'] === [], 422);

        return response()->json($action->handle($input['email'], $input['ministry_ids'])->projection(), 201);
    }

    public function revokeInvitation(Request $request, string $id, ManageTeachers $manage)
    {
        $this->owner($request);
        $this->input($request, []);
        DB::transaction(function () use ($manage, $id) {
            $owner = $manage->owner();
            $invitation = Invitation::where('church_id', $owner->church_id)->lockForUpdate()->findOrFail($id);
            abort_if($invitation->accepted_at !== null, 410);
            if (! $invitation->revoked_at) {
                $invitation->forceFill(['revoked_at' => now()])->save();
                app(RecordMembershipAudit::class)->handle($owner->church_id, $owner->user_id, 'invitation.revoked', $id);
            }
        });

        return response()->noContent();
    }

    public function accept(Request $request, AcceptTeacherInvitation $action)
    {
        $request->merge(['email' => is_string($request->input('email')) ? mb_strtolower(trim($request->input('email'))) : $request->input('email')]);
        $input = $this->input($request, [
            'church_id' => ['required', 'uuid'], 'invitation_id' => ['required', 'uuid'],
            'token' => ['required', 'string', 'size:64'], 'signature' => ['required', 'string', 'size:64'],
            'expires' => ['required', 'integer'], 'email' => ['required', 'email:rfc', 'max:254'],
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'password' => ['sometimes', 'required', 'string', 'max:128', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);
        if ($request->hasHeader('X-Church-Id')) {
            abort_unless(strtolower($request->header('X-Church-Id')) === strtolower($input['church_id']), 410);
        }

        return response()->json(['church_id' => $action->handle($input), 'status' => 'accepted']);
    }

    public function assign(Request $request, string $id, ManageTeachers $manage)
    {
        $this->owner($request);
        $input = $this->input($request, $this->ministryRules());
        DB::transaction(function () use ($manage, $id, $input) {
            $owner = $manage->owner();
            $teacher = $manage->teacher($id);
            $manage->assign($teacher, $input['ministry_ids'], $owner->user_id);
            app(RevokeMembershipAccess::class)->handle($id, $teacher->user_id, $owner->church_id);
            app(RecordMembershipAudit::class)->handle($owner->church_id, $owner->user_id, 'teacher.assigned', $id);
        });

        return response()->json(['ministry_ids' => $input['ministry_ids']]);
    }

    public function revoke(Request $request, string $id, RevokeTeacher $action)
    {
        $this->owner($request);
        $this->input($request, []);
        $action->handle($id);

        return response()->noContent();
    }

    public function transfer(Request $request, TransferOwnership $action)
    {
        $this->owner($request);
        $input = $this->input($request, ['target_membership_id' => ['required', 'uuid'], 'password' => ['required', 'string', 'max:128'], 'code' => ['required', 'string', 'regex:/^\d{6}$/']]);
        $action->handle($input['target_membership_id'], $input['password'], $input['code']);
        if ($request->hasSession()) {
            Auth::guard('web')->logoutCurrentDevice();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->noContent();
    }

    public function ministries(Request $request, ?string $id = null)
    {
        $churchId = app(TenantContext::class)->churchId();
        $query = DB::table('ministries')->where('ministries.church_id', $churchId)->whereNull('archived_at');
        if (! (new ChurchMembershipPolicy)->manage($request->user())) {
            $membership = ChurchMembership::where('church_id', $churchId)->where('user_id', $request->user()->id)->where('status', 'active')->firstOrFail();
            $query->whereIn('id', DB::table('teacher_ministry_assignments')->select('ministry_id')->where('church_id', $churchId)->where('membership_id', $membership->id)->whereNull('revoked_at'));
        }
        if ($id !== null) {
            return response()->json($query->where('id', $id)->firstOrFail(['id', 'name']));
        }

        return response()->json(['data' => $query->orderBy('name')->orderBy('id')->get(['id', 'name'])]);
    }
}
