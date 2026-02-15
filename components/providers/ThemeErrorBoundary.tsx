'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary specifically for theme-related errors
 * Prevents theme initialization issues from crashing the entire app
 */
export class ThemeErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Theme error boundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            backgroundColor: '#0b0f1a',
            color: '#f1f5f9',
            padding: 2,
          }}
        >
          <Typography variant="h4" sx={{ marginBottom: 2 }}>
            Theme Initialization Error
          </Typography>
          <Typography variant="body1" sx={{ marginBottom: 3, textAlign: 'center' }}>
            There was an issue initializing the theme system. This usually resolves on refresh.
          </Typography>
          {this.state.error && (
            <Typography
              variant="body2"
              sx={{
                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                padding: 2,
                borderRadius: 1,
                marginBottom: 3,
                fontFamily: 'monospace',
                maxWidth: '600px',
                overflow: 'auto',
              }}
            >
              {this.state.error.message}
            </Typography>
          )}
          <Button
            variant="contained"
            onClick={this.handleReset}
            sx={{ marginRight: 1 }}
          >
            Try Again
          </Button>
          <Button
            variant="outlined"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
