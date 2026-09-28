<?php

namespace App\Enums;

enum AttendanceState: string
{
    case Unmarked = 'unmarked';
    case Present = 'present';
    case Absent = 'absent';
}
