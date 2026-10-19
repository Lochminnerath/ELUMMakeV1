import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { RedirectIfSignedIn, RequireAuth } from './auth/guards';
import { DesignIcon } from './components/Brand';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FullPageLoader } from './components/Loader';
import { ToastProvider } from './components/Toast';
import { TooltipLayer } from './components/TooltipLayer';
import { AuthPage } from './pages/AuthPage';
import { HandoffPage } from './pages/HandoffPage';
import { HomePage } from './pages/HomePage';
import { ThemeProvider } from './theme/ThemeProvider';
import { WhatsNew } from './whatsnew/WhatsNew';

// The editor is the heaviest part of the app, so it loads on demand.
const EditorPage = lazy(() => import('./editor/EditorPage'));

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <Routes>
                <Route
                  path="/signin"
                  element={
                    <RedirectIfSignedIn>
                      <AuthPage mode="signin" />
                    </RedirectIfSignedIn>
                  }
                />
                <Route
                  path="/signup"
                  element={
                    <RedirectIfSignedIn>
                      <AuthPage mode="signup" />
                    </RedirectIfSignedIn>
                  }
                />
                <Route path="/auth/handoff" element={<HandoffPage />} />
                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <HomePage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/m/:designId"
                  element={
                    <RequireAuth>
                      <Suspense fallback={<FullPageLoader label="Opening your design" />}>
                        <EditorPage />
                      </Suspense>
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
          <TooltipLayer />
          <WhatsNew />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

function NotFound() {
  return (
    <div className="empty-state" style={{ minHeight: '100%', justifyContent: 'center' }}>
      <DesignIcon size={64} />
      <h2>We could not find that page</h2>
      <p>The link may be wrong, or the page may have moved.</p>
      <Link to="/" className="elum-btn elum-btn--primary">
        Go to your designs
      </Link>
    </div>
  );
}
