<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SchemaEdgeDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int    $projectId,
        public readonly string $edgeId,
    ) {}

    public function broadcastOn(): array
    {
        return [new PresenceChannel('project.' . $this->projectId)];
    }

    public function broadcastWith(): array
    {
        return ['edgeId' => $this->edgeId];
    }
}
