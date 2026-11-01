import { Badge } from './PlayerLink.jsx';
import { MAX_SHOWN_RANKS } from '../game/achievements.js';
import { PICTURES, DEFAULT_PICTURE, pictureFile } from '../game/pictures.js';

// the title chooser used on the profile and in the settings. mine comes from the player's own profile (see publicProfile)
// titles are shown in the order they were picked: hide one and pick it again to move it to the end
export function TitlePicker({ mine, onToggle, onMove }) {
  const used = mine.titles.filter((t) => t !== 'owner' && t !== 'admin').length;

  return (
    <>
      <p className="fine pick-label">
        Titles you show, in order. Pick up to {MAX_SHOWN_RANKS} ranks (Owner and Admin are extra). The first one sets your profile color. To move one, hide it and pick it again, it goes last.
      </p>
      <div className="chips aim">
        {mine.pickable.length === 0 && <span className="fine">You have no ranks yet. Earn them with achievements or buy them in the Shop.</span>}
        {mine.pickable.map((titleId) => {
          const on = mine.titles.includes(titleId);
          const free = titleId === 'owner' || titleId === 'admin';
          return (
            <button
              key={titleId}
              type="button"
              className={on ? 'chip pick title on' : 'chip pick title'}
              disabled={!on && !free && used >= MAX_SHOWN_RANKS}
              onClick={() => onToggle(titleId)}
            >
              <Badge id={titleId} />
              {on && <span className="order">{mine.titles.indexOf(titleId) + 1}</span>}
            </button>
          );
        })}
      </div>
      {onMove && mine.titles.length > 1 && (
        <ol className="order-list">
          {mine.titles.map((titleId, i) => (
            <li key={titleId}>
              <Badge id={titleId} />
              <button type="button" className="btn small ghost" disabled={i === 0} onClick={() => onMove(titleId, -1)} aria-label="Move earlier">
                Up
              </button>
              <button type="button" className="btn small ghost" disabled={i === mine.titles.length - 1} onClick={() => onMove(titleId, 1)} aria-label="Move later">
                Down
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

// the pictures a player owns, plus the free default
export function PicturePicker({ mine, byAdmin, onPick }) {
  const keys = [DEFAULT_PICTURE, ...mine.owned.filter((k) => Object.hasOwn(PICTURES, k))];

  return (
    <>
      <p className="fine pick-label">Picture</p>
      <div className="chips aim">
        {keys.map((key) => (
          <button key={key} type="button" className={mine.picture === key ? 'pic-pick on' : 'pic-pick'} title={PICTURES[key].name} onClick={() => onPick(key)}>
            <img src={pictureFile(key)} alt={PICTURES[key].name} />
          </button>
        ))}
      </div>
      {byAdmin && <p className="fine">An admin set your picture, so it shows instead of your choice.</p>}
    </>
  );
}
