<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ServiceType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LaundryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_register_and_create_a_persistent_order(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Alex Rivera',
            'email' => 'alex@example.test',
            'password' => 'strong-password',
            'password_confirmation' => 'strong-password',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.role', 'customer')
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role']]);

        $customer = User::where('email', 'alex@example.test')->firstOrFail();
        $service = ServiceType::create(['name' => 'Wash & Fold', 'price' => 30, 'unit' => 'kg']);
        Sanctum::actingAs($customer);

        $this->postJson('/api/orders', [
            'service_type_id' => $service->id,
            'quantity' => 2.5,
            'pickup_date' => now()->addDay()->toDateString(),
        ])->assertCreated()
            ->assertJsonPath('data.customer', 'Alex Rivera')
            ->assertJsonPath('data.amount', 75)
            ->assertJsonPath('data.status', 'Received');

        $this->assertDatabaseHas('orders', ['user_id' => $customer->id, 'total_amount' => 75]);
        $this->assertDatabaseHas('payments', ['status' => 'unpaid', 'amount' => 75]);
    }

    public function test_login_only_accepts_credentials_for_the_selected_account_type(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $staff = User::factory()->create(['role' => 'staff']);
        $customer = User::factory()->create(['role' => 'customer']);

        $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'password',
            'role' => 'admin',
        ])->assertOk()->assertJsonPath('user.role', 'admin');

        $this->postJson('/api/login', [
            'email' => $staff->email,
            'password' => 'password',
            'role' => 'admin',
        ])->assertOk()->assertJsonPath('user.role', 'staff');

        $this->postJson('/api/login', [
            'email' => $customer->email,
            'password' => 'password',
            'role' => 'customer',
        ])->assertOk()->assertJsonPath('user.role', 'customer');

        $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'password',
            'role' => 'customer',
        ])->assertUnprocessable()->assertJsonPath('message', 'The provided credentials are incorrect.');

        $this->postJson('/api/login', [
            'email' => $customer->email,
            'password' => 'password',
            'role' => 'admin',
        ])->assertUnprocessable()->assertJsonPath('message', 'The provided credentials are incorrect.');
    }

    public function test_customers_cannot_see_another_customers_orders_or_update_status(): void
    {
        $owner = User::factory()->create(['role' => 'customer']);
        $otherCustomer = User::factory()->create(['role' => 'customer']);
        $order = Order::create([
            'user_id' => $owner->id,
            'order_number' => 'LND-1234',
            'order_date' => now(),
            'pickup_date' => now()->addDay(),
            'total_amount' => 50,
            'status' => 'Received',
        ]);
        Sanctum::actingAs($otherCustomer);

        $this->getJson("/api/orders/{$order->order_number}")->assertNotFound();
        $this->patchJson("/api/orders/{$order->order_number}/status", ['status' => 'Washing'])->assertForbidden();
    }

    public function test_staff_can_advance_status_and_record_payment(): void
    {
        $staff = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create(['role' => 'customer']);
        $order = Order::create([
            'user_id' => $customer->id,
            'order_number' => 'LND-1235',
            'order_date' => now(),
            'pickup_date' => now()->addDay(),
            'total_amount' => 50,
            'status' => 'Received',
        ]);
        $order->payments()->create(['amount' => 50, 'method' => 'cash', 'status' => 'unpaid']);
        Sanctum::actingAs($staff);

        $this->patchJson("/api/orders/{$order->order_number}/status", ['status' => 'Washing'])
            ->assertOk()
            ->assertJsonPath('data.status', 'Washing');
        $this->postJson("/api/orders/{$order->order_number}/payment", ['method' => 'cash'])
            ->assertOk()
            ->assertJsonPath('data.payment', 'Paid');

        $this->assertDatabaseHas('order_status_updates', ['order_id' => $order->id, 'status' => 'Washing', 'user_id' => $staff->id]);
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'status' => 'paid']);
    }

    public function test_order_status_cannot_skip_a_workflow_step(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);
        $customer = User::factory()->create(['role' => 'customer']);
        $order = Order::create([
            'user_id' => $customer->id,
            'order_number' => 'LND-1236',
            'order_date' => now(),
            'pickup_date' => now()->addDay(),
            'total_amount' => 50,
            'status' => 'Received',
        ]);
        Sanctum::actingAs($staff);

        $this->patchJson("/api/orders/{$order->order_number}/status", ['status' => 'Drying'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Orders can only advance to the next workflow status.');
    }

    public function test_customer_can_cancel_only_an_unpaid_received_order(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $order = Order::create([
            'user_id' => $customer->id,
            'order_number' => 'LND-1237',
            'order_date' => now(),
            'pickup_date' => now()->addDay(),
            'total_amount' => 50,
            'status' => 'Received',
        ]);
        $order->payments()->create(['amount' => 50, 'method' => 'cash', 'status' => 'unpaid']);
        Sanctum::actingAs($customer);

        $this->deleteJson("/api/orders/{$order->order_number}")
            ->assertOk()
            ->assertJsonPath('message', 'Order cancelled.');
        $this->assertDatabaseMissing('orders', ['order_number' => 'LND-1237']);
    }

    public function test_staff_can_create_edit_and_remove_a_service(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));

        $created = $this->postJson('/api/services', [
            'name' => 'Express Wash',
            'description' => 'Same-day washing.',
            'price' => 50,
            'unit' => 'kg',
        ])->assertCreated()->assertJsonPath('data.name', 'Express Wash');
        $serviceId = $created->json('data.id');

        $this->putJson("/api/services/{$serviceId}", [
            'name' => 'Express Wash',
            'description' => 'Updated service.',
            'price' => 60,
            'unit' => 'kg',
        ])->assertOk()->assertJsonPath('data.price', '60.00');

        $this->deleteJson("/api/services/{$serviceId}")->assertOk();
        $this->assertDatabaseMissing('service_types', ['id' => $serviceId]);
    }

    public function test_staff_can_create_read_update_and_delete_customers_without_order_history(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));

        $created = $this->postJson('/api/customers', [
            'name' => 'Taylor Reed',
            'email' => 'taylor@example.test',
            'password' => 'a-secure-password',
        ])->assertCreated()
            ->assertJsonPath('data.name', 'Taylor Reed')
            ->assertJsonPath('data.orders_count', 0);
        $customerId = $created->json('data.id');

        $this->getJson('/api/customers')->assertOk()->assertJsonFragment(['email' => 'taylor@example.test']);
        $this->getJson("/api/customers/{$customerId}")->assertOk()->assertJsonPath('data.id', $customerId);
        $this->putJson("/api/customers/{$customerId}", [
            'name' => 'Taylor Reed Updated',
            'email' => 'taylor.updated@example.test',
            'password' => 'another-secure-password',
        ])->assertOk()->assertJsonPath('data.name', 'Taylor Reed Updated');

        $this->deleteJson("/api/customers/{$customerId}")->assertOk();
        $this->assertDatabaseMissing('users', ['id' => $customerId]);
    }

    public function test_staff_cannot_delete_customers_with_order_history(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);
        $customer = User::factory()->create(['role' => 'customer']);
        Order::create([
            'user_id' => $customer->id,
            'order_number' => 'LND-1240',
            'order_date' => now(),
            'pickup_date' => now()->addDay(),
            'total_amount' => 50,
            'status' => 'Received',
        ]);
        Sanctum::actingAs($staff);

        $this->deleteJson("/api/customers/{$customer->id}")
            ->assertStatus(409)
            ->assertJsonPath('message', 'Customers with order history cannot be deleted.');
        $this->assertDatabaseHas('users', ['id' => $customer->id]);
    }

    public function test_customer_can_update_only_their_unpaid_received_order(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $otherCustomer = User::factory()->create(['role' => 'customer']);
        $service = ServiceType::create(['name' => 'Wash & Fold', 'price' => 30, 'unit' => 'kg']);
        $order = Order::create([
            'user_id' => $customer->id,
            'order_number' => 'LND-1241',
            'order_date' => now(),
            'pickup_date' => now()->addDay(),
            'total_amount' => 60,
            'status' => 'Received',
        ]);
        $order->items()->create(['service_type_id' => $service->id, 'quantity' => 2, 'unit_price' => 30]);
        $order->payments()->create(['amount' => 60, 'method' => 'cash', 'status' => 'unpaid']);
        Sanctum::actingAs($customer);

        $this->putJson("/api/orders/{$order->order_number}", [
            'service_type_id' => $service->id,
            'quantity' => 3,
            'pickup_date' => now()->addDays(2)->toDateString(),
        ])->assertOk()
            ->assertJsonPath('data.amount', 90)
            ->assertJsonPath('data.quantity', 3);

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'total_amount' => 90]);
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'amount' => 90, 'status' => 'unpaid']);
        $this->assertDatabaseHas('order_items', ['order_id' => $order->id, 'quantity' => 3]);
        $this->assertDatabaseHas('order_status_updates', ['order_id' => $order->id, 'update_note' => 'Order details updated.']);

        Sanctum::actingAs($otherCustomer);
        $this->putJson("/api/orders/{$order->order_number}", [
            'service_type_id' => $service->id,
            'quantity' => 1,
            'pickup_date' => now()->addDays(2)->toDateString(),
        ])->assertNotFound();
    }

    public function test_service_with_order_history_is_archived_and_can_be_reactivated(): void
    {
        $staff = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create(['role' => 'customer']);
        $service = ServiceType::create(['name' => 'Archive-safe service', 'price' => 30, 'unit' => 'kg']);
        $order = Order::create([
            'user_id' => $customer->id,
            'order_number' => 'LND-1242',
            'order_date' => now(),
            'pickup_date' => now()->addDay(),
            'total_amount' => 30,
            'status' => 'Received',
        ]);
        $order->items()->create(['service_type_id' => $service->id, 'quantity' => 1, 'unit_price' => 30]);

        Sanctum::actingAs($staff);
        $this->deleteJson("/api/services/{$service->id}")->assertOk();
        $this->assertDatabaseHas('service_types', ['id' => $service->id, 'is_active' => false]);
        Sanctum::actingAs($customer);
        $this->getJson('/api/services')->assertOk()->assertJsonMissing(['name' => 'Archive-safe service']);

        Sanctum::actingAs($staff);
        $this->putJson("/api/services/{$service->id}", [
            'name' => $service->name,
            'description' => null,
            'price' => 30,
            'unit' => 'kg',
            'is_active' => true,
        ])->assertOk()->assertJsonPath('data.is_active', true);
    }

    public function test_staff_order_search_status_filters_and_pagination_are_applied_by_the_api(): void
    {
        $staff = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create(['role' => 'customer']);
        foreach (range(1, 5) as $index) {
            Order::create([
                'user_id' => $customer->id,
                'order_number' => 'LND-20'.str_pad((string) $index, 2, '0', STR_PAD_LEFT),
                'order_date' => now()->subMinutes($index),
                'pickup_date' => now()->addDay(),
                'total_amount' => 50,
                'status' => $index < 4 ? 'Washing' : 'Received',
            ]);
        }
        Sanctum::actingAs($staff);

        $response = $this->getJson('/api/orders?status=Washing&search=LND-20&per_page=2&page=2');

        $response->assertOk()
            ->assertJsonPath('current_page', 2)
            ->assertJsonPath('last_page', 2)
            ->assertJsonPath('total', 3)
            ->assertJsonCount(1, 'data');
    }
}
