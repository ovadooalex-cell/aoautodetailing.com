import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  fallback: ReactNode;
  onError?: () => void;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * The GLTF/Three.js load pipeline can throw uncaught errors while parsing a
 * bad/missing model or texture response, rather than always going through a
 * loader's own `onError`. Without a boundary that crashes the whole app —
 * this catches it and swaps in the static fallback instead.
 */
export default class CarSceneErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[CarScene] 3D scene failed to load, showing fallback.', error);
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
