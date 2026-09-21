<?php

namespace App\Http\Controllers;

use App\Actions\Applications\SubmitChurchApplication;
use App\Http\Requests\SubmitChurchApplicationRequest;
use App\Models\ChurchApplication;
use Illuminate\Http\Request;

final class ChurchApplicationController extends Controller
{
    public function store(SubmitChurchApplicationRequest $request, SubmitChurchApplication $action)
    {
        return response()->json($action->handle($request->user('web'), $request->validated())->projection(), 201);
    }

    public function current(Request $request)
    {
        $application = ChurchApplication::query()->where('user_id', $request->user('web')->id)->whereNull('purged_at')->latest()->orderByDesc('id')->first();

        return response()->json(['application' => $application?->projection()]);
    }
}
