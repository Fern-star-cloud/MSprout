<?php

namespace App\Enums;

enum AttendanceSessionStatus: string
{
    case Draft = 'draft';
    case FinalizedPending = 'finalized_pending';
    case Finalized = 'finalized';
    case NeedsReview = 'needs_review';
    case Revised = 'revised';
}
