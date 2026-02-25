import Topology from "../components/Topology";
import CommandTester from "../components/CommandTester";
import HandshakeViewer from "../components/HandshakeViewer";
import CommunicationLogs from "../components/CommunicationLogs";

function Home({
  status,
  connected,
  logs,
  handshakeSteps,
  sendCommand,
  clearLogs,
  clearHandshake,
}) {
  return (
    <div className="app-content">
      <div className="left-panel">
        <Topology status={status} />
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
