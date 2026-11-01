import BuyModal from './BuyModal.jsx';

const titles = { create: 'Create lobby', join: 'Join lobby', play: 'Start playing' };

// the confirm box for the multiplayer entry fee. the quote comes from the server, so the numbers are the real ones
export default function EntryModal({ entry, onPay, onCancel }) {
  const { action, quote } = entry;
  const { price, full, discount, saved, balance } = quote;

  const rows = [];
  if (saved) {
    rows.push(['Entry fee', `${full} Digipogs`]);
    rows.push(['Saved entry', 'covers it']);
  } else {
    rows.push(['Entry fee', `${full} Digipogs`]);
    if (discount > 0) rows.push(['Leaderboard discount', `${discount}% off`]);
  }
  rows.push(['You pay', price === 0 ? 'nothing' : `${price} Digipogs`, true]);
  if (balance != null) {
    rows.push(['Your Digipogs', balance.toLocaleString()]);
    if (price > 0) rows.push(['After paying', Math.max(0, balance - price).toLocaleString()]);
  }

  return (
    <BuyModal
      title={titles[action]}
      text={(action === 'create' ? 'Creating a lobby costs an entry fee.' : 'Playing in a lobby costs an entry fee. Watching is free.') + (balance == null && price > 0 ? ' Formbar checks your balance when you pay.' : '')}
      price={price}
      rows={rows}
      payLabel={price === 0 ? 'Continue' : `Pay ${price} and ${action === 'create' ? 'create' : action === 'join' ? 'join' : 'play'}`}
      onPay={onPay}
      onCancel={onCancel}
    />
  );
}
