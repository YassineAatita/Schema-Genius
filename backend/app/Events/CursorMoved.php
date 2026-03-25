<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CursorMoved implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int    $projectId,
        public readonly int    $userId,
        public readonly string $name,
        public readonly float  $x,
        public readonly float  $y,
    ) {}

    public function broadcastOn(): array
    {
        return [new PresenceChannel('project.' . $this->projectId)];
    }

    public function broadcastWith(): array
    {
        return [
            'userId' => $this->userId,
            'name'   => $this->name,
            'x'      => $this->x,
            'y'      => $this->y,
        ];
    }
}
