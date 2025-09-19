import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import type { Container } from '@harbourmaster/shared';

export function useContainers(showAll = false) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContainers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.getContainers(showAll);
      if (response.success && response.data) {
        setContainers(response.data);
      } else {
        setError(response.error || 'Failed to fetch containers');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    fetchContainers();

    const eventSource = apiClient.subscribeToEvents();

    const handleContainerEvent = () => {
      fetchContainers();
    };

    const handleError = (error: Event) => {
      console.error('SSE connection error:', error);
      eventSource.close();
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (!eventSource.readyState || eventSource.readyState === EventSource.CLOSED) {
          window.location.reload();
        }
      }, 5000);
    };

    eventSource.addEventListener('container', handleContainerEvent);
    eventSource.addEventListener('error', handleError);

    return () => {
      eventSource.removeEventListener('container', handleContainerEvent);
      eventSource.removeEventListener('error', handleError);
      eventSource.close();
    };
  }, [fetchContainers]);

  const startContainer = async (id: string) => {
    const response = await apiClient.startContainer(id);
    if (response.success) {
      await fetchContainers();
    }
    return response;
  };

  const stopContainer = async (id: string) => {
    const response = await apiClient.stopContainer(id);
    if (response.success) {
      await fetchContainers();
    }
    return response;
  };

  const restartContainer = async (id: string) => {
    const response = await apiClient.restartContainer(id);
    if (response.success) {
      await fetchContainers();
    }
    return response;
  };

  const deleteContainer = async (id: string) => {
    const response = await apiClient.deleteContainer(id);
    if (response.success) {
      await fetchContainers();
    }
    return response;
  };

  return {
    containers,
    isLoading,
    error,
    refetch: fetchContainers,
    startContainer,
    stopContainer,
    restartContainer,
    deleteContainer,
  };
}