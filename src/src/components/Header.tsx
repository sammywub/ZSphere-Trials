import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div>
          <p className="header-eyebrow">Zama FHE game</p>
          <h1 className="header-title">ZSphere Trials</h1>
          <p className="header-subtitle">
            Start with 100 encrypted points, choose your path across four spheres, and decrypt your score only when you
            sign the request.
          </p>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
