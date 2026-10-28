import Logo from './Logo.jsx';
import Keys from './Keys.jsx';

export default function LoginScreen() {
  const failed = new URLSearchParams(window.location.search).get('error') === 'login';

  return (
    <main className="login">
      <div className="login-main">
        <Logo />
        <p className="tagline">Play Tetris! Play Tetris please! Play it now!</p>
        {failed && <p className="error">Login failed, please try again.</p>}
        <a className="btn big" href="/login">
          Log in with Formbar
        </a>
        <p className="fine">have fun! expect more stuff to come soon :)</p>
      </div>

      <aside className="box login-keys">
        <h2 className="box-title">Controls</h2>
        <Keys />
      </aside>
    </main>
  );
}
