import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';
import BuyModal from './BuyModal.jsx';
import PlayerLink, { Badge, Badges } from './PlayerLink.jsx';
import { getShop, buyItem, equipPicture, chooseRanks } from '../api.js';
import { PICTURES, DEFAULT_PICTURE, pictureFile } from '../game/pictures.js';
import { MAX_SHOWN_RANKS } from '../game/achievements.js';


// one card. the corner flag says where the item stands, the footer has the one thing you can do with it
function Card({ item, flag, art, action, fresh }) {
  return (
    <li className={`shop-card${item.kind === 'rank' ? ' rank' : ''}${item.rare ? ' rare' : ''}${flag ? ' mine' : ''}${fresh === item.id ? ' fresh' : ''}`}>
      <div className="shop-art">
        {art}
        {flag && (
          <span key={flag.text} className={`flag${flag.on ? ' on' : ''}`}>
            {flag.text}
          </span>
        )}
        {item.rare && <span className="rare-tag">Rare</span>}
      </div>
      <div className="shop-info">
        <b className="shop-name">{item.name}</b>
        <span className="shop-text">{item.text}</span>
      </div>
      <div className="shop-foot">
        {!item.owned && (
          <span className="price">
            {item.price !== item.basePrice && <s>{item.basePrice}</s>}
            {item.price.toLocaleString()}
            <small>DP</small>
          </span>
        )}
        {action}
      </div>
    </li>
  );
}

export default function Shop({ user, onBack, onBought, onChanged, onProfile }) {
  const [shop, setShop] = useState(null);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState(null); // the item being paid for
  const [tab, setTab] = useState('pictures');
  const [fresh, setFresh] = useState(''); // the item just bought, for a small pop

  function load() {
    getShop()
      .then(setShop)
      .catch((err) => setError(err.message));
  }
  useEffect(load, []);

  async function equip(picture) {
    setError('');
    try {
      await equipPicture(picture);
      load();
      onChanged(); // the menu shows the new picture
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleRank(id) {
    const titles = shop.mine.titles;
    const next = titles.includes(id) ? titles.filter((t) => t !== id) : [...titles, id];
    if (next.filter((t) => t !== 'owner' && t !== 'admin').length > MAX_SHOWN_RANKS) {
      setError(`You can show ${MAX_SHOWN_RANKS} ranks at a time, hide one first.`);
      return;
    }
    setError('');
    try {
      await chooseRanks(next);
      load();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function pay(pin, requestId) {
    await buyItem(buying.id, pin, requestId, buying.price);
    const bought = buying;
    setBuying(null);
    setFresh(bought.id);
    setTimeout(() => setFresh(''), 900);
    load();
    onBought(bought);
  }

  const pictures = shop ? shop.items.filter((i) => i.kind === 'picture') : [];
  const ranks = shop ? shop.items.filter((i) => i.kind === 'rank') : [];
  const sale = shop ? shop.sale : null;
  const ownedCount = (list) => list.filter((i) => i.owned).length;

  function buyButton(item) {
    return (
      <button className="btn small" onClick={() => setBuying(item)}>
        Buy
      </button>
    );
  }

  return (
    <div className="menu">
      <header className="topbar">
        <Logo small />
        <div className="user">
          <Badges ids={user.badges} />
          <PlayerLink id={user.id} name={user.name} onProfile={onProfile} className="username" />
          <button className="btn small ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      <section className="shop-page">
        <div className="shop-top">
          <h2 className="heading">Shop</h2>
          {shop && (
            <div className="tabs shop-tabs">
              <button type="button" className={tab === 'pictures' ? 'tab on' : 'tab'} onClick={() => setTab('pictures')}>
                Pictures <small>{ownedCount(pictures) + 1}/{pictures.length + 1}</small>
              </button>
              <button type="button" className={tab === 'ranks' ? 'tab on' : 'tab'} onClick={() => setTab('ranks')}>
                Ranks <small>{ownedCount(ranks)}/{ranks.length}</small>
              </button>
            </div>
          )}
        </div>

        {error && <p className="error">{error}</p>}
        {!shop && !error && <p className="fine">LOADING...</p>}

        {sale && sale.percent > 0 && (
          <p className="sale-bar">
            <b>{sale.percent}% off</b> everything{sale.label ? ` · ${sale.label}` : ''}
          </p>
        )}

        {shop && tab === 'pictures' && (
          <ul className="shop-grid" key="pictures">
            <Card
              fresh={fresh}
              item={{ id: DEFAULT_PICTURE, name: PICTURES[DEFAULT_PICTURE].name, text: PICTURES[DEFAULT_PICTURE].text, owned: true }}
              flag={{ text: shop.mine.picture === DEFAULT_PICTURE ? 'Equipped' : 'Owned', on: shop.mine.picture === DEFAULT_PICTURE }}
              art={<img src={pictureFile(DEFAULT_PICTURE)} alt="" />}
              action={
                <button className="btn small ghost wide" disabled={shop.mine.picture === DEFAULT_PICTURE} onClick={() => equip(DEFAULT_PICTURE)}>
                  Equip
                </button>
              }
            />
            {pictures.map((item) => {
              const equipped = shop.mine.picture === item.id;
              return (
                <Card
              fresh={fresh}
                  key={item.id}
                  item={item}
                  flag={item.owned ? { text: equipped ? 'Equipped' : 'Owned', on: equipped } : null}
                  art={<img src={pictureFile(item.id)} alt="" />}
                  action={
                    item.owned ? (
                      <button className="btn small ghost wide" disabled={equipped} onClick={() => equip(item.id)}>
                        Equip
                      </button>
                    ) : (
                      buyButton(item)
                    )
                  }
                />
              );
            })}
          </ul>
        )}

        {shop && tab === 'ranks' && (
          <>
            <p className="fine shop-hint">Show up to {MAX_SHOWN_RANKS} ranks next to your name. The first one you show colors your profile.</p>
            <ul className="shop-grid" key="ranks">
              {ranks.map((item) => {
                const place = shop.mine.titles.indexOf(item.id);
                return (
                  <Card
              fresh={fresh}
                    key={item.id}
                    item={item}
                    flag={item.owned ? { text: place >= 0 ? `Showing ${place + 1}` : 'Owned', on: place >= 0 } : null}
                    art={<Badge id={item.id} big />}
                    action={
                      item.owned ? (
                        <button className="btn small ghost wide" onClick={() => toggleRank(item.id)}>
                          {place >= 0 ? 'Hide' : 'Show'}
                        </button>
                      ) : (
                        buyButton(item)
                      )
                    }
                  />
                );
              })}
            </ul>
            <p className="fine credit">
              The sans. rank is drawn in Pixel Comic Sans (Undertale Sans Font) by ColorSwitchFan25, fontstruct.com/fontstructions/show/1534860
            </p>
          </>
        )}
      </section>

      {buying && (
        <BuyModal
          title={buying.name}
          text={`${buying.kind === 'rank' ? 'A rank for your name.' : 'A profile picture.'} You keep it forever.`}
          price={buying.price}
          onPay={pay}
          onCancel={() => setBuying(null)}
        />
      )}
    </div>
  );
}
