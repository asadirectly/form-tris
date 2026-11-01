import { useEffect, useState } from 'react';
import { admin } from '../api.js';

// one row, edits are saved with the button so a half typed price is never sent
function Row({ item, onSaved, onError }) {
  const [price, setPrice] = useState(String(item.price));
  const [text, setText] = useState(item.text);

  const changed = Number(price) !== item.price || text !== item.text;

  async function save(changes) {
    try {
      await admin('PUT', `/shop/items/${item.id}`, changes);
      onSaved();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <li className="shop-row">
      <div className="shop-row-name">
        <b>{item.name}</b> <small>{item.label} · sold {item.sold}</small>
      </div>
      <input type="number" min={1} max={100000} value={price} onChange={(e) => setPrice(e.target.value)} aria-label="price" />
      <input type="text" maxLength={120} value={text} onChange={(e) => setText(e.target.value)} aria-label="description" />
      <button className="btn small" disabled={!changed} onClick={() => save({ price: Number(price), text })}>
        Save
      </button>
      <button className="btn small ghost" onClick={() => save({ enabled: !item.enabled })}>
        {item.enabled ? 'Hide' : 'Show'}
      </button>
      {(item.price !== item.defaultPrice || item.text !== item.defaultText) && (
        <button className="btn small ghost" onClick={() => save({ price: item.defaultPrice, text: item.defaultText })}>
          Reset
        </button>
      )}
    </li>
  );
}

export default function AdminShop() {
  const [shop, setShop] = useState(null);
  const [error, setError] = useState('');
  const [percent, setPercent] = useState('0');
  const [label, setLabel] = useState('');

  function load() {
    admin('GET', '/shop')
      .then((data) => {
        setShop(data);
        setPercent(String(data.sale.percent));
        setLabel(data.sale.label);
      })
      .catch((err) => setError(err.message));
  }
  useEffect(load, []);

  async function saveSale(e) {
    e.preventDefault();
    setError('');
    try {
      await admin('PUT', '/shop/sale', { percent: Number(percent), label });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function onError(message) {
    setError(message);
    load(); // put the rows back to what is really saved
  }

  if (!shop) return error ? <p className="error">{error}</p> : <p className="loading">LOADING...</p>;

  return (
    <>
      <form className="box form" onSubmit={saveSale}>
        <h3 className="box-title">Sale</h3>
        <p className="fine">Takes a percent off everything in the shop. Rounds and the multiplayer entry fee are not part of it.</p>
        <div className="admin-row">
          <label>
            Percent off (0 to 90)
            <input type="number" min={0} max={90} value={percent} onChange={(e) => setPercent(e.target.value)} />
          </label>
          <label>
            Banner text
            <input type="text" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <button type="submit" className="btn small">
            Save sale
          </button>
        </div>
      </form>

      <div className="box">
        <h3 className="box-title">Items</h3>
        {error && <p className="error">{error}</p>}
        <ul className="admin-list shop-rows">
          {shop.items.map((item) => (
            <Row key={`${item.id}-${item.price}-${item.text}`} item={item} onSaved={load} onError={onError} />
          ))}
        </ul>
        <p className="fine">Prices are whole Digipogs, 1 to 100,000. Hidden items disappear from the shop but players keep what they own.</p>
      </div>
    </>
  );
}
