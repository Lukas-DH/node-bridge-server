import { useState, useEffect } from 'react';
import './PipetteSelector.css';

function PipetteSelector({ socket }) {
  const [pipettes, setPipettes] = useState([]);
  const [activePipette, setActivePipette] = useState(null);

  useEffect(() => {
    if (!socket) return;

    // Listen for pipette list updates
    socket.on('pipettes-list', (list) => {
      setPipettes(list);
    });

    // Listen for active pipette updates
    socket.on('active-pipette', (model) => {
      setActivePipette(model);
    });

    return () => {
      socket.off('pipettes-list');
      socket.off('active-pipette');
    };
  }, [socket]);

  const handleSelectPipette = (model) => {
    if (socket) {
      socket.emit('select-pipette', model);
    }
  };

  if (pipettes.length === 0) {
    return (
      <div className="pipette-selector">
        <h3>Select Active Pipette</h3>
        <p className="no-pipettes">No pipettes discovered</p>
      </div>
    );
  }

  return (
    <div className="pipette-selector">
      <h3>Select Active Pipette</h3>
      <div className="pipette-list">
        {pipettes.map((pipette) => (
          <label
            key={pipette.model}
            className={`pipette-option ${!pipette.connected ? 'disconnected' : ''}`}
          >
            <input
              type="radio"
              name="pipette"
              value={pipette.model}
              checked={activePipette === pipette.model}
              onChange={() => handleSelectPipette(pipette.model)}
              disabled={!pipette.connected}
            />
            <div className="pipette-info">
              <span className="pipette-model">{pipette.model}</span>
              <span className="pipette-port">{pipette.port}</span>
            </div>
            <span className={`status-indicator ${pipette.connected ? 'connected' : 'disconnected'}`}>
              {pipette.connected ? '🟢' : '🔴'}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default PipetteSelector;
