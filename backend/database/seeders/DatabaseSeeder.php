<?php

namespace Database\Seeders;

use App\Models\Order;
use App\Models\ServiceType;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $staffEmail = env('DEMO_STAFF_EMAIL') ?: 'staff@freshfold.test';
        $staffPassword = env('DEMO_STAFF_PASSWORD');
        if (! $staffPassword && app()->environment('production')) {
            throw new \RuntimeException('Set DEMO_STAFF_PASSWORD before seeding the production database.');
        }

        $staff = User::updateOrCreate(
            ['email' => $staffEmail],
            ['name' => 'John Paul Aplacador', 'password' => Hash::make($staffPassword ?: 'password'), 'role' => 'admin'],
        );

        if (app()->environment('production')) {
            $this->seedServices();

            return;
        }

        $customers = collect([
            ['Samantha Lee', 'samantha@example.test'],
            ['Marcus Chen', 'marcus@example.test'],
            ['Olivia Martin', 'olivia@example.test'],
            ['James Wilson', 'james@example.test'],
            ['Ava Thompson', 'ava@example.test'],
            ['Noah Garcia', 'noah@example.test'],
            ['Isabella Brown', 'isabella@example.test'],
        ])->mapWithKeys(fn (array $customer) => [
            $customer[0] => User::updateOrCreate(
                ['email' => $customer[1]],
                ['name' => $customer[0], 'password' => Hash::make('password'), 'role' => 'customer'],
            ),
        ]);

        $services = $this->seedServices();

        $samples = [
            ['Samantha Lee', 'Wash & Fold', 6.5, 195, 'Washing', 'paid', '2026-10-20 09:42:00', '2026-10-21'],
            ['Marcus Chen', 'Dry Cleaning', 3, 420, 'Ready for Pickup', 'unpaid', '2026-10-20 09:18:00', '2026-10-21'],
            ['Olivia Martin', 'Wash & Fold', 4.2, 126, 'Drying', 'paid', '2026-10-20 08:56:00', '2026-10-22'],
            ['James Wilson', 'Bedding & Linen', 2, 350, 'Received', 'unpaid', '2026-10-20 08:30:00', '2026-10-22'],
            ['Ava Thompson', 'Wash & Fold', 8, 240, 'Completed', 'paid', '2026-10-20 08:12:00', '2026-10-20'],
            ['Noah Garcia', 'Ironing', 5, 175, 'Washing', 'paid', '2026-10-19 15:12:00', '2026-10-21'],
            ['Isabella Brown', 'Dry Cleaning', 2, 280, 'Completed', 'paid', '2026-10-19 13:45:00', '2026-10-20'],
            ['Samantha Lee', 'Dry Cleaning', 1, 140, 'Received', 'unpaid', '2026-10-18 13:10:00', '2026-10-22'],
            ['Marcus Chen', 'Ironing', 4, 140, 'Washing', 'paid', '2026-10-18 12:35:00', '2026-10-21'],
            ['Olivia Martin', 'Bedding & Linen', 1, 175, 'Ready for Pickup', 'unpaid', '2026-10-18 11:50:00', '2026-10-21'],
            ['James Wilson', 'Wash & Fold', 3.5, 105, 'Drying', 'paid', '2026-10-18 10:20:00', '2026-10-22'],
            ['Ava Thompson', 'Dry Cleaning', 2, 280, 'Completed', 'paid', '2026-10-17 16:40:00', '2026-10-19'],
            ['Noah Garcia', 'Bedding & Linen', 2, 350, 'Received', 'unpaid', '2026-10-17 15:15:00', '2026-10-23'],
            ['Isabella Brown', 'Wash & Fold', 5, 150, 'Washing', 'paid', '2026-10-17 14:05:00', '2026-10-21'],
            ['Samantha Lee', 'Ironing', 6, 210, 'Completed', 'paid', '2026-10-16 17:30:00', '2026-10-18'],
            ['Marcus Chen', 'Wash & Fold', 7.5, 225, 'Ready for Pickup', 'unpaid', '2026-10-16 16:10:00', '2026-10-21'],
            ['Olivia Martin', 'Dry Cleaning', 3, 420, 'Drying', 'paid', '2026-10-16 14:25:00', '2026-10-22'],
            ['James Wilson', 'Ironing', 2, 70, 'Received', 'unpaid', '2026-10-15 13:55:00', '2026-10-22'],
            ['Ava Thompson', 'Bedding & Linen', 1, 175, 'Completed', 'paid', '2026-10-15 12:30:00', '2026-10-17'],
            ['Noah Garcia', 'Dry Cleaning', 1, 140, 'Washing', 'paid', '2026-10-15 11:45:00', '2026-10-21'],
        ];

        foreach ($samples as $index => [$customerName, $serviceName, $quantity, $amount, $status, $paymentStatus, $orderDate, $pickupDate]) {
            $orderNumber = 'LND-'.(1048 - $index);
            $order = Order::firstOrCreate(
                ['order_number' => $orderNumber],
                [
                    'user_id' => $customers[$customerName]->id,
                    'order_date' => $orderDate,
                    'pickup_date' => $pickupDate,
                    'total_amount' => $amount,
                    'status' => $status,
                ],
            );

            $order->items()->firstOrCreate(
                ['service_type_id' => $services[$serviceName]->id],
                ['quantity' => $quantity, 'unit_price' => $services[$serviceName]->price],
            );

            $order->payments()->firstOrCreate(
                ['order_id' => $order->id],
                [
                    'amount' => $amount,
                    'method' => 'cash',
                    'status' => $paymentStatus,
                    'paid_at' => $paymentStatus === 'paid' ? $orderDate : null,
                ],
            );

            $order->statusUpdates()->firstOrCreate(
                ['order_id' => $order->id, 'status' => $status],
                ['user_id' => $staff->id, 'update_note' => 'Sample order status.', 'updated_at' => $orderDate],
            );
        }
    }

    private function seedServices()
    {
        return collect([
            ['Wash & Fold', 'Everyday washing and folding.', 30, 'kg'],
            ['Dry Cleaning', 'Professional dry cleaning per garment.', 140, 'item'],
            ['Bedding & Linen', 'Fresh cleaning for bedding and linens.', 175, 'item'],
            ['Ironing', 'Pressed and neatly finished garments.', 35, 'item'],
        ])->mapWithKeys(fn (array $service) => [
            $service[0] => ServiceType::updateOrCreate(
                ['name' => $service[0]],
                ['description' => $service[1], 'price' => $service[2], 'unit' => $service[3], 'is_active' => true],
            ),
        ]);
    }
}
