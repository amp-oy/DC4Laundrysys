<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $orders = Order::query()->when(! $user->isStaff(), fn (Builder $query) => $query->where('user_id', $user->id));
        $unpaid = (clone $orders)->whereHas('payments', fn (Builder $query) => $query->where('status', 'unpaid'));

        return response()->json([
            'total_orders' => (clone $orders)->count(),
            'in_progress' => (clone $orders)->whereIn('status', ['Received', 'Washing', 'Drying'])->count(),
            'received' => (clone $orders)->where('status', 'Received')->count(),
            'ready_for_pickup' => (clone $orders)->where('status', 'Ready for Pickup')->count(),
            'unpaid_orders' => (clone $unpaid)->count(),
            'unpaid_amount' => (float) (clone $unpaid)->sum('total_amount'),
            'washing' => (clone $orders)->where('status', 'Washing')->count(),
            'drying' => (clone $orders)->where('status', 'Drying')->count(),
            'recent_orders' => (clone $orders)->with(['customer:id,name,email', 'items.serviceType:id,name,unit', 'payments'])
                ->latest('order_date')->limit(5)->get()
                ->map(fn (Order $order) => app(OrderController::class)->serializeForDashboard($order)),
        ]);
    }
}
