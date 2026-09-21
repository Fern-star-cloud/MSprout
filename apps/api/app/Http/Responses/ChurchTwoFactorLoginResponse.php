<?php

namespace App\Http\Responses;

use Laravel\Fortify\Http\Responses\TwoFactorLoginResponse;

final class ChurchTwoFactorLoginResponse extends TwoFactorLoginResponse
{
    public function toResponse($request)
    {
        $request->session()->put('church_mfa_user_id', $request->user()->getKey());

        return parent::toResponse($request);
    }
}
