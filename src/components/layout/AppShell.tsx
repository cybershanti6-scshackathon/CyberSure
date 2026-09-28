import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useCyberSure } from '@/lib/store';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNotify } from '@/components/ui/Toast';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SearchPalette } from '@/components/search/SearchPalette';
import { ScanOverlay } from '@/components/common/ScanOverlay';

export function AppShell() {
  const { analysis, runScan, scanRunning } = useCyberSure();
  // The console opens with the navigation expanded so the map is visible.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const notify = useNotify();
  const location = useLocation();

  // Ctrl/Cmd + K opens global search from anywhere.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Reset scroll on navigation.
  useEffect(() => {
    const main = document.getElementById('cybersure-main');
    if (main && typeof main.scrollTo === 'function') main.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const openFindings = analysis.findings.filter((finding) => finding.status === 'open').length;

  const handleRunScan = useCallback(() => {
    setScanOpen(true);
    void runScan().then((result) => {
      notify.success(
        'Scan complete',
        `${result.devicesScanned} devices analysed · ${result.unresolvedFindings} open findings · posture ${result.postureAfter}/100`,
      );
    });
  }, [runScan, notify]);

  const toggleNav = () => {
    if (isDesktop) setCollapsed((value) => !value);
    else setMobileNavOpen((value) => !value);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-ink-950 [html.light_&]:bg-ink-50">
      {isDesktop ? <Sidebar collapsed={collapsed} openIssues={openFindings} /> : null}

      {!isDesktop && mobileNavOpen ? (
        <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            className="absolute inset-0 bg-ink-950/70 [html.light_&]:bg-ink-900/40"
            onClick={() => setMobileNavOpen(false)}
            role="presentation"
          />
          <div className="relative h-full w-[236px] animate-slide-in-right">
            <Sidebar collapsed={false} openIssues={openFindings} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          sidebarCollapsed={isDesktop ? collapsed : !mobileNavOpen}
          onToggleSidebar={toggleNav}
          onOpenSearch={() => setSearchOpen(true)}
          onRunScan={handleRunScan}
          scanRunning={scanRunning}
        />
        <main id="cybersure-main" className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 sm:py-6">
            <Outlet />
          </div>
        </main>
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ScanOverlay open={scanOpen} onClose={() => setScanOpen(false)} />
    </div>
  );
}
