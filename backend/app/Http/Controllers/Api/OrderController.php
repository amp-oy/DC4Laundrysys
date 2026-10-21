<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderStatusUpdate;
use App\Models\ServiceType;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    private const STATUSES = ['Received', 'Washing', 'Drying', 'Ready for Pickup', 'Completed'];

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['sometimes', 'string', 'max:120'],
            'status' => ['sometimes', Rule::in(self::STATUSES)],
            'service_id' => ['sometimes', 'integer', 'exists:service_types,id'],
            'date' => ['sometimes', 'date_format:Y-m-d'],
            'pickup_date' => ['sometimes', 'date_format:Y-m-d'],
            'payment_status' => ['sometimes', Rule::in(['paid', 'unpaid'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $orders = $this->visibleOrders($request->user())
            ->with(['customer:id,name,email', 'items.serviceType:id,name,unit', 'payments'])
            ->when($request->filled('status'), fn (Builder $query) => $query->where('status', $request->string('status')))
            ->when($request->filled('service_id'), fn (Builder $query) => $query->whereHas('items', fn (Builder $items) => $items->where('service_type_id', $request->integer('service_id'))))
            ->when($request->filled('date'), fn (Builder $query) => $query->whereDate('order_date', $request->date('date')))
            ->when($request->filled('pickup_date'), fn (Builder $query) => $query->whereDate('pickup_date', $request->date('pickup_date')))
            ->when($request->filled('payment_status'), fn (Builder $query) => $query->whereHas('payments', fn (Builder $payments) => $payments->where('status', $request->string('payment_status'))))
            ->when($request->filled('search'), function (Builder $query) use ($request) {
                $search = trim((string) $request->query('search'));
                $query->where(function (Builder $matches) use ($search) {
                    $matches->where('order_number', 'like', "%{$search}%")
                        ->orWhereHas('customer', fn (Builder $customer) => $customer->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"))
                        ->orWhereHas('items.serviceType', fn (Builder $service) => $service->where('name', 'like', "%{$search}%"));
                });
            })
            ->latest('order_date')
            ->paginate(min(max($request->integer('per_page', 10), 1), 100))
            ->through(fn (Order $order) => $this->orderData($order));

        return response()->json($orders);
    }

    public function show(Request $request, Order $order): JsonResponse
    {
        $this->authorizeOrder($request->user(), $order);

        return response()->json(['data' => $this->orderData($order->load([
            'customer:id,name,email',
            'items.serviceType:id,name,unit',
            'payments',
            'statusUpdates.user:id,name',
        ]), true)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_id' => [Rule::requiredIf($request->user()->isStaff()), 'nullable', 'integer', Rule::exists('users', 'id')->where('role', 'customer')],
            'service_type_id' => ['required', 'integer', Rule::exists('service_types', 'id')->where('is_active', true)],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:1000'],
            'pickup_date' => ['required', 'date', 'after_or_equal:today'],
        ]);

        $customerId = $request->user()->isStaff() ? $data['customer_id'] : $request->user()->id;
        $service = ServiceType::findOrFail($data['service_type_id']);
        $quantity = (float) $data['quantity'];

        $order = DB::transaction(function () use ($customerId, $service, $quantity, $data, $request) {
            $order = Order::create([
                'user_id' => $customerId,
                'order_number' => 'PENDING-'.uniqid(),
                'order_date' => now(),
                'pickup_date' => $data['pickup_date'],
                'total_amount' => round($service->price * $quantity, 2),
                'status' => 'Received',
            ]);
            $order->update(['order_number' => 'LND-'.str_pad((string) (1041 + $order->id), 4, '0', STR_PAD_LEFT)]);
            $order->items()->create(['service_type_id' => $service->id, 'quantity' => $quantity, 'unit_price' => $service->price]);
            $order->payments()->create(['amount' => $order->total_amount, 'method' => 'cash', 'status' => 'unpaid']);
            $order->statusUpdates()->create(['user_id' => $request->user()->id, 'status' => 'Received', 'update_note' => 'Order created.', 'updated_at' => now()]);

            return $order;
        });

        return response()->json(['data' => $this->orderData($order->load(['customer:id,name,email', 'items.serviceType:id,name,unit', 'payments']))], 201);
    }

    public function update(Request $request, Order $order): JsonResponse
    {
        $this->authorizeOrder($request->user(), $order);
        abort_unless(
            $order->status === 'Received' && ! $order->payments()->where('status', 'paid')->exists(),
            422,
            'Only unpaid received orders can be edited.',
        );

        $data = $request->validate([
            'customer_id' => [Rule::requiredIf($request->user()->isStaff()), 'nullable', 'integer', Rule::exists('users', 'id')->where('role', 'customer')],
            'service_type_id' => ['required', 'integer', Rule::exists('service_types', 'id')->where('is_active', true)],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:1000'],
            'pickup_date' => ['required', 'date', 'after_or_equal:today'],
        ]);

        $service = ServiceType::findOrFail($data['service_type_id']);
        $quantity = (float) $data['quantity'];
        $customerId = $request->user()->isStaff() ? $data['customer_id'] : $order->user_id;

        DB::transaction(function () use ($order, $service, $quantity, $customerId, $data, $request) {
            $order->update([
                'user_id' => $customerId,
                'pickup_date' => $data['pickup_date'],
                'total_amount' => round($service->price * $quantity, 2),
            ]);
            $order->items()->firstOrFail()->update([
                'service_type_id' => $service->id,
                'quantity' => $quantity,
                'unit_price' => $service->price,
            ]);
            $order->payments()->where('status', 'unpaid')->update(['amount' => $order->total_amount]);
            $order->statusUpdates()->create([
                'user_id' => $request->user()->id,
                'status' => $order->status,
                'update_note' => 'Order details updated.',
                'updated_at' => now(),
            ]);
        });

        return response()->json(['data' => $this->orderData($order->refresh()->load([
            'customer:id,name,email',
            'items.serviceType:id,name,unit',
            'payments',
        ]))]);
    }

    public function updateStatus(Request $request, Order $order): JsonResponse
    {
        abort_unless($request->user()->isStaff(), 403, 'Staff access is required.');

        $data = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
            'update_note' => ['nullable', 'string', 'max:500'],
        ]);

        $current = array_search($order->status, self::STATUSES, true);
        $next = array_search($data['status'], self::STATUSES, true);
        if ($current === false || $next !== $current + 1) {
            return response()->json(['message' => 'Orders can only advance to the next workflow status.'], 422);
        }

        DB::transaction(function () use ($request, $order, $data) {
            $order->update(['status' => $data['status']]);
            $order->statusUpdates()->create([
                'user_id' => $request->user()->id,
                'status' => $data['status'],
                'update_note' => $data['update_note'] ?? null,
                'updated_at' => now(),
            ]);
        });

        return response()->json(['data' => $this->orderData($order->refresh()->load(['customer:id,name,email', 'items.serviceType:id,name,unit', 'payments']))]);
    }

    public function markPaid(Request $request, Order $order): JsonResponse
    {
        abort_unless($request->user()->isStaff(), 403, 'Staff access is required.');
        $data = $request->validate(['method' => ['sometimes', Rule::in(['cash', 'card', 'online'])]]);

        $payment = $order->payments()->where('status', 'unpaid')->first();
        if (! $payment) {
            return response()->json(['message' => 'No unpaid balance remains for this order.'], 422);
        }

        $payment->update(['status' => 'paid', 'method' => $data['method'] ?? 'cash', 'paid_at' => now()]);

        return response()->json(['data' => $this->orderData($order->refresh()->load(['customer:id,name,email', 'items.serviceType:id,name,unit', 'payments']))]);
    }

    public function destroy(Request $request, Order $order): JsonResponse
    {
        $this->authorizeOrder($request->user(), $order);
        abort_unless($order->status === 'Received' && ! $order->payments()->where('status', 'paid')->exists(), 422, 'Only unpaid received orders can be cancelled.');

        $order->delete();

        return response()->json(['message' => 'Order cancelled.']);
    }

    public function serializeForDashboard(Order $order): array
    {
        return $this->orderData($order);
    }

    private function visibleOrders(User $user): Builder
    {
        return Order::query()->when(! $user->isStaff(), fn (Builder $query) => $query->where('user_id', $user->id));
    }

    private function authorizeOrder(User $user, Order $order): void
    {
        abort_unless($user->isStaff() || $order->user_id === $user->id, 404);
    }

    private function orderData(Order $order, bool $includeHistory = false): array
    {
        $firstItem = $order->items->first();
        $payment = $order->payments->first();
        $data = [
            'id' => $order->order_number,
            'customer_id' => $order->user_id,
            'customer' => $order->customer?->name ?? 'Customer',
            'email' => $order->customer?->email,
            'initials' => collect(explode(' ', $order->customer?->name ?? 'C'))->map(fn ($part) => mb_substr($part, 0, 1))->take(2)->implode(''),
            'service' => $firstItem?->serviceType?->name ?? 'Laundry service',
            'service_type_id' => $firstItem?->service_type_id,
            'unit' => $firstItem?->serviceType?->unit ?? 'item',
            'quantity' => (float) ($firstItem?->quantity ?? 0),
            'weight' => rtrim(rtrim(number_format((float) ($firstItem?->quantity ?? 0), 2), '0'), '.').' '.(($firstItem?->serviceType?->unit ?? 'item') === 'kg' ? 'kg' : 'items'),
            'amount' => (float) $order->total_amount,
            'date' => $order->order_date->toIso8601String(),
            'pickup' => $order->pickup_date->toDateString(),
            'status' => $order->status,
            'payment' => $payment?->status === 'paid' ? 'Paid' : 'Unpaid',
            'payment_method' => $payment?->method,
            'color' => 'blue',
        ];

        if ($includeHistory) {
            $data['status_history'] = $order->statusUpdates->map(fn (OrderStatusUpdate $update) => [
                'status' => $update->status,
                'note' => $update->update_note,
                'updated_at' => $update->updated_at?->toIso8601String(),
                'updated_by' => $update->user?->name,
            ]);
        }

        return $data;
    }
}
