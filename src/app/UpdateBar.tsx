import { pwa } from '../i18n/de-CH';
import { dismissUpdate, useUpdate } from './pwa';

/** Neue Version im Hintergrund geladen: fragen statt still neu zu laden (Eingaben könnten verloren gehen). */
export function UpdateBar() {
  const reload = useUpdate();
  if (!reload) return null;
  return (
    <div className="update-bar" role="status">
      <span>{pwa.update.text}</span>
      <button className="btn sm primary" onClick={reload}>
        {pwa.update.reload}
      </button>
      <button className="btn sm quiet" onClick={dismissUpdate}>
        {pwa.update.later}
      </button>
    </div>
  );
}
