/**
 * Error boundary for character sheet components
 */

import React, { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import i18n from '@/i18n/i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CharacterSheetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Character sheet error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="glass-panel p-6">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="p-4 rounded-full bg-red-100">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-warm-gray">
              {i18n.t('character:editor.errorBoundaryTitle')}
            </h3>
            <p className="text-sm text-stone-gray text-center max-w-md">
              {this.state.error?.message || i18n.t('character:editor.errorBoundaryDefaultMessage')}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-moss-green text-white rounded-lg hover:bg-moss-green/90 transition-colors"
            >
              {i18n.t('common:tryAgain')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
