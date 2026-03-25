<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SchemaNodeUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int    $projectId,
        public readonly string $nodeId,
        public readonly array  $data,   // table name + columns payload
    ) {}

    public function broadcastOn(): array
    {
        return [new PresenceChannel('project.' . $this->projectId)];
    }

    public function broadcastWith(): array
    {
        return [
            'nodeId' => $this->nodeId,
            'data'   => $this->data,
        ];
    }
}
