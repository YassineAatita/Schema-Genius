<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SchemaNodeAdded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int   $projectId,
        public readonly array $node,   // full React Flow node object
    ) {}

    public function broadcastOn(): array
    {
        return [new PresenceChannel('project.' . $this->projectId)];
    }

    public function broadcastWith(): array
    {
        return ['node' => $this->node];
    }
}
