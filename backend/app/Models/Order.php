<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = ['user_id', 'order_number', 'order_date', 'pickup_date', 'total_amount', 'status'];

    protected function casts(): array
    {
        return ['order_date' => 'datetime', 'pickup_date' => 'date', 'total_amount' => 'decimal:2'];
    }

    public function getRouteKeyName(): string
    {
        return 'order_number';
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function statusUpdates(): HasMany
    {
        return $this->hasMany(OrderStatusUpdate::class);
    }
}
