<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class AttendanceReportResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'role' => $this->resource['role'],
            'can_export' => $this->resource['can_export'],
            'filters' => $this->resource['filters'],
            'summary' => $this->resource['summary'],
            'sessions' => $this->resource['sessions'],
        ];
    }
}
