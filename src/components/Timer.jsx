import { useEffect, useState } from 'react';
import { formatTime } from '../format.js';

export default function Timer({ getTime }) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTime(getTime()), 50);
    return () => clearInterval(id);
  }, []);

  return <span>{formatTime(time)}</span>;
}
