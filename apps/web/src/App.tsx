import { useHashRoute } from './lib/router';
import { Home } from './screens/Home';
import { LocalGameView, LocalSetup } from './screens/LocalScreens';
import { AccessLink, CreateRoom, FacilitatorRemote, FamilyRemote, Join, StationRemote } from './screens/RoomScreens';

export function App() {
  const r = useHashRoute();
  let page;
  if (r[0] === 'demo' && r[1] === 'preparar') page = <LocalSetup />;
  else if (r[0] === 'demo') page = <LocalGameView />;
  else if (r[0] === 'sala' && r[1] === 'crear') page = <CreateRoom />;
  else if (r[0] === 'unirse') page = <Join />;
  else if (r[0] === 'acceso' && r[1] && r[2]) page = <AccessLink code={r[1]} keyParam={r[2]} />;
  else if (r[0] === 'sala' && r[1] && r[2] === 'facilitador') page = <FacilitatorRemote code={r[1]} />;
  else if (r[0] === 'sala' && r[1] && r[2] === 'familia') page = <FamilyRemote code={r[1]} />;
  else if (r[0] === 'sala' && r[1] && r[2] === 'estacion') page = <StationRemote code={r[1]} />;
  else page = <Home />;
  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Saltar al contenido
      </a>
      <div id="main" tabIndex={-1} className="main-wrap">
        {page}
      </div>
    </>
  );
}
