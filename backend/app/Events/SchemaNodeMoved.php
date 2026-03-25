<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SchemaNodeMoved implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int    $projectId,
        public readonly string $nodeId,
        public readonly array  $position,  // { x: float, y: float }
    ) {}

    /** Broadcast on the project presence channel, to all OTHER users */
    public function broadcastOn(): array
    {
        return [new PresenceChannel('project.' . $this->projectId)];
    }

    public function broadcastWith(): array
    {
        return [
            'nodeId'   => $this->nodeId,
            'position' => $this->position,
        ];
    }
}
