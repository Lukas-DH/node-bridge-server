import Topology from "../components/Topology";
import CommandTester from "../components/CommandTester";
import HandshakeViewer from "../components/HandshakeViewer";
import CommunicationLogs from "../components/CommunicationLogs";
import PipetteSelector from "../components/PipetteSelector";

function Home({
  status,
  connected,
  logs,
  handshakeSteps,
  sendCommand,
  clearLogs,
  clearHandshake,
  socket,
}) {
  return (
    <div className="app-content">
      <div className="left-panel">
        <Topology status={status} />
        <PipetteSelector socket={socket} />
        <CommandTester onSendCommand={sendCommand} disabled={!connected} />
      </div>

      <div className="right-panel">
        <HandshakeViewer steps={handshakeSteps} onClear={clearHandshake} />
        <CommunicationLogs logs={logs} onClear={clearLogs} />
      </div>
    </div>
  );
}

export default Home;
