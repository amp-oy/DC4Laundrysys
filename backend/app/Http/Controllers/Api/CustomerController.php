<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->customersQuery()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
        ]);
        $data['password'] = Hash::make($data['password']);

        $customer = User::create([...$data, 'role' => 'customer']);

        return response()->json(['data' => $this->customerData($customer)], 201);
    }

    public function show(User $customer): JsonResponse
    {
        abort_unless($customer->role === 'customer', 404);

        return response()->json(['data' => $this->customerData($customer->loadCount('orders'))]);
    }

    public function update(Request $request, User $customer): JsonResponse
    {
        abort_unless($customer->role === 'customer', 404);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($customer->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:8'],
        ]);
        if (filled($data['password'] ?? null)) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $customer->update($data);

        return response()->json(['data' => $this->customerData($customer->refresh()->loadCount('orders'))]);
    }

    public function destroy(User $customer): JsonResponse
    {
        abort_unless($customer->role === 'customer', 404);
        abort_if($customer->orders()->exists(), 409, 'Customers with order history cannot be deleted.');

        $customer->delete();

        return response()->json(['message' => 'Customer deleted.']);
    }

    private function customersQuery()
    {
        return User::query()
            ->where('role', 'customer')
            ->withCount('orders')
            ->orderBy('name')
            ->get(['id', 'name', 'email']);
    }

    private function customerData(User $customer): array
    {
        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'email' => $customer->email,
            'orders_count' => $customer->orders_count ?? $customer->orders()->count(),
        ];
    }
}
