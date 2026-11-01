import { useEffect, useState } from 'react';

// a button that needs a second click to go through. it goes back to normal after a few seconds
export default function ConfirmButton({ children, ask = 'Are you sure?', onConfirm, className = 'btn small ghost', disabled }) {
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!asking) return;
    const id = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(id);
  }, [asking]);

  return (
    <button
      type="button"
      className={asking ? 'btn small danger' : className}
      disabled={disabled}
      onClick={() => {
        if (!asking) return setAsking(true);
        setAsking(false);
        onConfirm();
      }}
    >
      {asking ? ask : children}
    </button>
  );
}
