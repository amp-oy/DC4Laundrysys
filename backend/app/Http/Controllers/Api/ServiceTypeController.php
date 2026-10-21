<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ServiceTypeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $services = ServiceType::query()
            ->when(! $request->user()?->isStaff(), fn ($query) => $query->where('is_active', true))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $services]);
    }

    public function store(Request $request): JsonResponse
    {
        $service = ServiceType::create($this->validated($request));

        return response()->json(['data' => $service], 201);
    }

    public function update(Request $request, ServiceType $serviceType): JsonResponse
    {
        $serviceType->update($this->validated($request, $serviceType));

        return response()->json(['data' => $serviceType->refresh()]);
    }

    public function destroy(ServiceType $serviceType): JsonResponse
    {
        if ($serviceType->orderItems()->exists()) {
            $serviceType->update(['is_active' => false]);
        } else {
            $serviceType->delete();
        }

        return response()->json(['message' => $serviceType->exists ? 'Service deactivated.' : 'Service deleted.']);
    }

    private function validated(Request $request, ?ServiceType $serviceType = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('service_types', 'name')->ignore($serviceType?->id)],
            'description' => ['nullable', 'string', 'max:1000'],
            'price' => ['required', 'numeric', 'gt:0', 'max:100000'],
            'unit' => ['required', 'string', 'in:kg,item'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
