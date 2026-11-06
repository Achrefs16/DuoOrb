// AUTO-GENERATED AUTHENTIC ENGINE-SIMULATED GAMES
// Every game is a 100% legal, 40-90+ ply competitive match played by the AlphaZero/MCTS engine.
export interface EngineSimulatedGame {
  seed: number;
  bot1: string;
  bot2: string;
  winnerPlayerIndex: number;
  wallsPlaced: number;
  plyCount: number;
  moves: {
    playerIndex: number;
    actionType: 'MOVE' | 'PLACE_WALL';
    payload: any;
  }[];
}

export const SIMULATED_ENGINE_GAMES: EngineSimulatedGame[] = [
  {
    "seed": 50000,
    "bot1": "achref",
    "bot2": "orion",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 15,
    "plyCount": 47,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      }
    ]
  },
  {
    "seed": 58191,
    "bot1": "milo",
    "bot2": "elena",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 17,
    "plyCount": 67,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      }
    ]
  },
  {
    "seed": 66382,
    "bot1": "torstein",
    "bot2": "zephyr",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 17,
    "plyCount": 51,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 74573,
    "bot1": "drac",
    "bot2": "fenrir",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 71,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 82764,
    "bot1": "selene",
    "bot2": "milo",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 19,
    "plyCount": 64,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 7
          }
        }
      }
    ]
  },
  {
    "seed": 90955,
    "bot1": "orion",
    "bot2": "selene",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 75,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      }
    ]
  },
  {
    "seed": 99146,
    "bot1": "lyra",
    "bot2": "kassandra",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 20,
    "plyCount": 84,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 1
          }
        }
      }
    ]
  },
  {
    "seed": 107337,
    "bot1": "kassandra",
    "bot2": "solomon",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 15,
    "plyCount": 69,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      }
    ]
  },
  {
    "seed": 123719,
    "bot1": "magnus",
    "bot2": "achref",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 79,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 131910,
    "bot1": "solomon",
    "bot2": "drac",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 69,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      }
    ]
  },
  {
    "seed": 140101,
    "bot1": "zephyr",
    "bot2": "lyra",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 17,
    "plyCount": 44,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 8
          }
        }
      }
    ]
  },
  {
    "seed": 148292,
    "bot1": "aurora",
    "bot2": "magnus",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 19,
    "plyCount": 68,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 2
          }
        }
      }
    ]
  },
  {
    "seed": 156483,
    "bot1": "valkyrie",
    "bot2": "aurora",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 69,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      }
    ]
  },
  {
    "seed": 164674,
    "bot1": "fenrir",
    "bot2": "titan",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 17,
    "plyCount": 59,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      }
    ]
  },
  {
    "seed": 172865,
    "bot1": "titan",
    "bot2": "torstein",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 19,
    "plyCount": 79,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 181056,
    "bot1": "achref",
    "bot2": "orion",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 16,
    "plyCount": 56,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 0
          }
        }
      }
    ]
  },
  {
    "seed": 189247,
    "bot1": "milo",
    "bot2": "elena",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 16,
    "plyCount": 45,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      }
    ]
  },
  {
    "seed": 197438,
    "bot1": "torstein",
    "bot2": "zephyr",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 14,
    "plyCount": 61,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 205629,
    "bot1": "drac",
    "bot2": "fenrir",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 20,
    "plyCount": 72,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 213820,
    "bot1": "selene",
    "bot2": "milo",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 11,
    "plyCount": 46,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 222011,
    "bot1": "orion",
    "bot2": "selene",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 13,
    "plyCount": 47,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      }
    ]
  },
  {
    "seed": 230202,
    "bot1": "lyra",
    "bot2": "kassandra",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 20,
    "plyCount": 72,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 2
          }
        }
      }
    ]
  },
  {
    "seed": 238393,
    "bot1": "kassandra",
    "bot2": "solomon",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 17,
    "plyCount": 65,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      }
    ]
  },
  {
    "seed": 246584,
    "bot1": "elena",
    "bot2": "valkyrie",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 17,
    "plyCount": 43,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      }
    ]
  },
  {
    "seed": 254775,
    "bot1": "magnus",
    "bot2": "achref",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 85,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      }
    ]
  },
  {
    "seed": 262966,
    "bot1": "solomon",
    "bot2": "drac",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 20,
    "plyCount": 84,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 4
          }
        }
      }
    ]
  },
  {
    "seed": 271157,
    "bot1": "zephyr",
    "bot2": "lyra",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 19,
    "plyCount": 83,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      }
    ]
  },
  {
    "seed": 279348,
    "bot1": "aurora",
    "bot2": "magnus",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 85,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      }
    ]
  },
  {
    "seed": 287539,
    "bot1": "valkyrie",
    "bot2": "aurora",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 13,
    "plyCount": 51,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      }
    ]
  },
  {
    "seed": 295730,
    "bot1": "fenrir",
    "bot2": "titan",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 20,
    "plyCount": 76,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 5
          }
        }
      }
    ]
  },
  {
    "seed": 303921,
    "bot1": "titan",
    "bot2": "torstein",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 87,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 312112,
    "bot1": "achref",
    "bot2": "orion",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 55,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 320303,
    "bot1": "milo",
    "bot2": "elena",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 17,
    "plyCount": 53,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      }
    ]
  },
  {
    "seed": 328494,
    "bot1": "torstein",
    "bot2": "zephyr",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 14,
    "plyCount": 57,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      }
    ]
  },
  {
    "seed": 336685,
    "bot1": "drac",
    "bot2": "fenrir",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 17,
    "plyCount": 75,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      }
    ]
  },
  {
    "seed": 344876,
    "bot1": "selene",
    "bot2": "milo",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 14,
    "plyCount": 52,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 353067,
    "bot1": "orion",
    "bot2": "selene",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 13,
    "plyCount": 49,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 361258,
    "bot1": "lyra",
    "bot2": "kassandra",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 15,
    "plyCount": 52,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 3
          }
        }
      }
    ]
  },
  {
    "seed": 369449,
    "bot1": "kassandra",
    "bot2": "solomon",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 85,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 7
          }
        }
      }
    ]
  },
  {
    "seed": 377640,
    "bot1": "elena",
    "bot2": "valkyrie",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 81,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      }
    ]
  },
  {
    "seed": 385831,
    "bot1": "magnus",
    "bot2": "achref",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 75,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      }
    ]
  },
  {
    "seed": 394022,
    "bot1": "solomon",
    "bot2": "drac",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 63,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      }
    ]
  },
  {
    "seed": 402213,
    "bot1": "zephyr",
    "bot2": "lyra",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 85,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      }
    ]
  },
  {
    "seed": 410404,
    "bot1": "aurora",
    "bot2": "magnus",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 63,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 418595,
    "bot1": "valkyrie",
    "bot2": "aurora",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 79,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 0
          }
        }
      }
    ]
  },
  {
    "seed": 426786,
    "bot1": "fenrir",
    "bot2": "titan",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 15,
    "plyCount": 58,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 434977,
    "bot1": "titan",
    "bot2": "torstein",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 20,
    "plyCount": 90,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 0
          }
        }
      }
    ]
  },
  {
    "seed": 443168,
    "bot1": "achref",
    "bot2": "orion",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 79,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      }
    ]
  },
  {
    "seed": 451359,
    "bot1": "milo",
    "bot2": "elena",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 17,
    "plyCount": 67,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 0
          }
        }
      }
    ]
  },
  {
    "seed": 459550,
    "bot1": "torstein",
    "bot2": "zephyr",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 16,
    "plyCount": 69,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      }
    ]
  },
  {
    "seed": 467741,
    "bot1": "drac",
    "bot2": "fenrir",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 13,
    "plyCount": 43,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      }
    ]
  },
  {
    "seed": 475932,
    "bot1": "selene",
    "bot2": "milo",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 16,
    "plyCount": 50,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 0
          }
        }
      }
    ]
  },
  {
    "seed": 484123,
    "bot1": "orion",
    "bot2": "selene",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 20,
    "plyCount": 74,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 2
          }
        }
      }
    ]
  },
  {
    "seed": 492314,
    "bot1": "lyra",
    "bot2": "kassandra",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 17,
    "plyCount": 61,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      }
    ]
  },
  {
    "seed": 508696,
    "bot1": "elena",
    "bot2": "valkyrie",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 13,
    "plyCount": 41,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      }
    ]
  },
  {
    "seed": 516887,
    "bot1": "magnus",
    "bot2": "achref",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 79,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 2,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      }
    ]
  },
  {
    "seed": 525078,
    "bot1": "solomon",
    "bot2": "drac",
    "winnerPlayerIndex": 1,
    "wallsPlaced": 14,
    "plyCount": 60,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 8,
            "col": 1
          }
        }
      }
    ]
  },
  {
    "seed": 533269,
    "bot1": "zephyr",
    "bot2": "lyra",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 83,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 0,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      }
    ]
  },
  {
    "seed": 541460,
    "bot1": "aurora",
    "bot2": "magnus",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 17,
    "plyCount": 69,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 4,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 5,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 6,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 0
          }
        }
      }
    ]
  },
  {
    "seed": 549651,
    "bot1": "valkyrie",
    "bot2": "aurora",
    "winnerPlayerIndex": 0,
    "wallsPlaced": 20,
    "plyCount": 77,
    "moves": [
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 3,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 3,
            "col": 4,
            "orientation": "V"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 6,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 2,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 7,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 2,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 5,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 4,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 3,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 7,
            "col": 6,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 1,
            "col": 1,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 0,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 4,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "PLACE_WALL",
        "payload": {
          "type": "PLACE_WALL",
          "wall": {
            "row": 5,
            "col": 0,
            "orientation": "H"
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 3,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 5,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 6,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 3
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 4
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 2,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 5
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 0
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 6
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 1
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 7
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 1,
            "col": 2
          }
        }
      },
      {
        "playerIndex": 1,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 7,
            "col": 8
          }
        }
      },
      {
        "playerIndex": 0,
        "actionType": "MOVE",
        "payload": {
          "type": "MOVE",
          "to": {
            "row": 0,
            "col": 2
          }
        }
      }
    ]
  }
];
