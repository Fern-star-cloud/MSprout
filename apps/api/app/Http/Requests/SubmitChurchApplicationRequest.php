<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SubmitChurchApplicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['church_name', 'city', 'address'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim(preg_replace('/[\p{Z}\s]+/u', ' ', $this->input($field)))]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'church_name' => ['required', 'string', 'max:160', 'not_regex:/[<>\p{C}]/u'],
            'city' => ['required', 'string', 'max:120', 'not_regex:/[<>\p{C}]/u'],
            'address' => ['nullable', 'string', 'max:240', 'not_regex:/[<>\p{C}]/u'],
            'timezone' => ['required', 'string', Rule::in(\DateTimeZone::listIdentifiers())],
            'captcha_token' => ['required', 'string', 'max:2048'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if (array_diff(array_keys($this->all()), array_keys($this->rules())) !== []) {
                $validator->errors()->add('application', 'Only application fields are accepted.');
            }
        });
    }
}
