<?php

namespace App\Domain\Imports;

use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use RuntimeException;
use Throwable;
use ZipArchive;

final class InspectWorkbook
{
    public const HEADERS = [
        'first_name', 'last_name', 'middle_name', 'preferred_name', 'suffix',
        'birthdate', 'gender', 'ministries', 'external_reference',
    ];

    private const MAX_BYTES = 5 * 1024 * 1024;

    private const MAX_EXPANDED_BYTES = 25 * 1024 * 1024;

    public function inspect(UploadedFile $file): array
    {
        if (! $file->isValid() || $file->getSize() === false || $file->getSize() > self::MAX_BYTES) {
            throw new RuntimeException('The spreadsheet is unavailable or exceeds 5 MiB.');
        }

        $extension = mb_strtolower($file->getClientOriginalExtension());
        if (! in_array($extension, ['csv', 'xlsx'], true)) {
            throw new RuntimeException('Only CSV and XLSX files are accepted.');
        }

        $path = $file->getRealPath();
        if (! is_string($path)) {
            throw new RuntimeException('The spreadsheet could not be inspected.');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        if (! is_string($mime)) {
            throw new RuntimeException('The spreadsheet type could not be verified.');
        }

        return $extension === 'csv'
            ? $this->csv($path, $mime)
            : $this->xlsx($path, $mime);
    }

    private function csv(string $path, string $mime): array
    {
        if (! in_array($mime, ['text/plain', 'text/csv', 'application/csv', 'text/x-csv'], true)) {
            throw new RuntimeException('The file content does not match CSV.');
        }
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new RuntimeException('The CSV could not be read.');
        }

        try {
            $records = [];
            while (($record = fgetcsv($handle, 0, ',', '"', '')) !== false) {
                if ($record === [null] || collect($record)->every(fn ($value) => trim((string) $value) === '')) {
                    continue;
                }
                $records[] = array_map(fn ($value) => $this->safeScalar($value), $record);
                if (count($records) > 501) {
                    throw new RuntimeException('The spreadsheet exceeds 500 data rows.');
                }
            }
        } finally {
            fclose($handle);
        }

        return $this->associate($records);
    }

    private function xlsx(string $path, string $mime): array
    {
        if (! in_array($mime, ['application/zip', 'application/octet-stream', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], true)) {
            throw new RuntimeException('The file content does not match XLSX.');
        }
        $this->inspectZip($path);

        $reader = IOFactory::createReader('Xlsx');
        $reader->setReadDataOnly(false);
        $reader->setReadEmptyCells(false);
        try {
            $spreadsheet = $reader->load($path);
        } catch (Throwable) {
            throw new RuntimeException('The XLSX workbook is malformed.');
        }
        try {
            if ($spreadsheet->getSheetCount() !== 1 || $spreadsheet->getSheet(0)->getSheetState() !== 'visible') {
                throw new RuntimeException('The workbook must contain one visible worksheet.');
            }
            $sheet = $spreadsheet->getSheet(0);
            if ($sheet->getHighestDataRow() > 501 || Coordinate::columnIndexFromString($sheet->getHighestDataColumn()) > count(self::HEADERS)) {
                throw new RuntimeException('The spreadsheet exceeds the supported shape.');
            }

            $records = [];
            $headers = [];
            for ($column = 1; $column <= Coordinate::columnIndexFromString($sheet->getHighestDataColumn()); $column++) {
                $headers[] = $this->safeScalar($sheet->getCell([$column, 1])->getValue());
            }
            $records[] = $headers;
            for ($row = 2; $row <= $sheet->getHighestDataRow(); $row++) {
                $record = [];
                $empty = true;
                foreach ($headers as $index => $header) {
                    $cell = $sheet->getCell([$index + 1, $row]);
                    if ($cell->getDataType() === DataType::TYPE_FORMULA) {
                        throw new RuntimeException('Formulas and executable spreadsheet content are not accepted.');
                    }
                    $value = $cell->getValue();
                    if ($header === 'birthdate' && (is_int($value) || is_float($value)) && Date::isDateTime($cell)) {
                        $value = Date::excelToDateTimeObject($value)->format('Y-m-d');
                    } elseif ($header === 'birthdate' && (is_int($value) || is_float($value))) {
                        throw new RuntimeException('Numeric birthdates must be genuine Excel date cells.');
                    }
                    $value = $this->safeScalar($value);
                    $record[] = $value;
                    $empty = $empty && trim($value) === '';
                }
                if (! $empty) {
                    $records[] = $record;
                }
            }
        } finally {
            $spreadsheet->disconnectWorksheets();
        }

        return $this->associate($records);
    }

    private function inspectZip(string $path): void
    {
        $zip = new ZipArchive;
        if ($zip->open($path, ZipArchive::RDONLY) !== true || $zip->numFiles > 250) {
            throw new RuntimeException('The XLSX package is malformed or too complex.');
        }
        try {
            $expanded = 0;
            $hasContentTypes = false;
            $hasWorkbook = false;
            $names = [];
            for ($index = 0; $index < $zip->numFiles; $index++) {
                $stat = $zip->statIndex($index);
                if (! is_array($stat)) {
                    throw new RuntimeException('The XLSX package is malformed.');
                }
                $name = str_replace('\\', '/', mb_strtolower((string) $stat['name']));
                if (isset($names[$name]) || str_contains($name, '../') || str_starts_with($name, '/') || preg_match('/(^|\/)(vbaproject\.bin|activex|embeddings|externallinks|customui|drawings|media|querytables|pivotcache|connections\.xml|_xmlsignatures)(\/|$)/', $name)) {
                    throw new RuntimeException('Macros, links, and embedded executable content are not accepted.');
                }
                $names[$name] = true;
                $expanded += (int) $stat['size'];
                if ($expanded > self::MAX_EXPANDED_BYTES || ((int) $stat['comp_size'] > 0 && (int) $stat['size'] / (int) $stat['comp_size'] > 100)) {
                    throw new RuntimeException('The XLSX package expands beyond safe limits.');
                }
                $hasContentTypes = $hasContentTypes || $name === '[content_types].xml';
                $hasWorkbook = $hasWorkbook || $name === 'xl/workbook.xml';
                if (str_ends_with($name, '.xml') || str_ends_with($name, '.rels')) {
                    $content = $zip->getFromIndex($index);
                    if (! is_string($content)) {
                        throw new RuntimeException('The XLSX package is malformed.');
                    }
                    if (preg_match('/<f(?:\s|>)/i', $content)) {
                        throw new RuntimeException('Formulas are not accepted.');
                    }
                    if (preg_match('/<!doctype|<!entity|<definedname(?:\s|>)|macroenabled|vbaproject|oleobject|externalreference|externalbook|targetmode\s*=\s*["\']external/i', $content)) {
                        throw new RuntimeException('Macros, external links, and executable workbook content are not accepted.');
                    }
                    if (preg_match('/<sheet\b[^>]*\bstate\s*=\s*["\'](?:hidden|veryHidden)["\']/i', $content)) {
                        throw new RuntimeException('Hidden worksheets are not accepted.');
                    }
                }
            }
            if (! $hasContentTypes || ! $hasWorkbook) {
                throw new RuntimeException('The XLSX package is malformed.');
            }
        } finally {
            $zip->close();
        }
    }

    private function associate(array $records): array
    {
        if (count($records) < 2) {
            throw new RuntimeException('The spreadsheet has no data rows.');
        }
        $headers = array_map(fn ($value) => mb_strtolower(trim((string) $value)), array_shift($records));
        $headers[0] = preg_replace('/\A\xEF\xBB\xBF/', '', $headers[0]) ?? $headers[0];
        if (count($headers) !== count(array_unique($headers))
            || array_diff($headers, self::HEADERS) !== []
            || ! in_array('first_name', $headers, true)
            || ! in_array('last_name', $headers, true)) {
            throw new RuntimeException('The spreadsheet headers are invalid.');
        }

        $rows = [];
        foreach ($records as $offset => $record) {
            if (count($record) > count($headers)) {
                throw new RuntimeException('A spreadsheet row contains unexpected columns.');
            }
            $record = array_pad($record, count($headers), '');
            $rows[] = ['row_number' => $offset + 2, 'values' => array_combine($headers, $record)];
        }
        if (count($rows) > 500) {
            throw new RuntimeException('The spreadsheet exceeds 500 data rows.');
        }

        return $rows;
    }

    private function safeScalar(mixed $value): string
    {
        if ($value === null) {
            return '';
        }
        if (! is_scalar($value)) {
            throw new RuntimeException('Unsupported spreadsheet cell content.');
        }
        $value = (string) $value;
        if (! mb_check_encoding($value, 'UTF-8') || str_contains($value, "\0") || preg_match('/\A\s*[=+\-@]/u', $value)) {
            throw new RuntimeException('Formulas and executable spreadsheet content are not accepted.');
        }
        if (mb_strlen($value) > 500) {
            throw new RuntimeException('A spreadsheet cell is too long.');
        }

        return $value;
    }
}
