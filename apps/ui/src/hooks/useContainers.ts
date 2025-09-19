import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../api/client';
import type { Container } from '@harbourmaster/shared';

export function useContainers(showAll = false) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchContainers = useCallback(async (isBackground = false) => {
    try {
      // Only show loading on initial load
      if (!isBackground && isInitialLoad.current) {
        setIsLoading(true);
      }
      setError(null);
      const response = await apiClient.getContainers(showAll);
      if (response.success && response.data) {
        setContainers(prevContainers => {
          // Only update if data actually changed
          const hasChanged = JSON.stringify(prevContainers) !== JSON.stringify(response.data);
          return hasChanged ? response.data : prevContainers;
        });
      } else {
        setError(response.error || 'Failed to fetch containers');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      if (!isBackground && isInitialLoad.current) {
        setIsLoading(false);
        isInitialLoad.current = false;
      }
    }
  }, [showAll]);

  const setupEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = apiClient.subscribeToEvents();
    eventSourceRef.current = eventSource;

    const handleDockerEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        // Only refresh on container-related events
        if (data.type === 'docker-event' && data.event && data.event.Type === 'container') {
          // Fetch in background mode - no loading state
          fetchContainers(true);
        }
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    const handleError = (error: Event) => {
      console.error('SSE connection error:', error);
      eventSource.close();

      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Reconnect after 5 seconds without page reload
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!eventSource.readyState || eventSource.readyState === EventSource.CLOSED) {
          console.log('Reconnecting to SSE...');
          setupEventSource();
        }
      }, 5000);
    };

    eventSource.addEventListener('message', handleDockerEvent);
    eventSource.addEventListener('error', handleError);

    return eventSource;
  }, [fetchContainers]);

  useEffect(() => {
    fetchContainers();
    const eventSource = setupEventSource();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [fetchContainers, setupEventSource]);

  const startContainer = async (id: string) => {
    try {
      const response = await apiClient.startContainer(id);
      if (response.success) {
        // Refresh the container list to get current state
        await fetchContainers(true);
      }
      return response;
    } catch (error) {
      console.error('Failed to start container:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const stopContainer = async (id: string) => {
    try {
      const response = await apiClient.stopContainer(id);
      if (response.success) {
        // Refresh the container list to get current state
        await fetchContainers(true);
      }
      return response;
    } catch (error) {
      console.error('Failed to stop container:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const restartContainer = async (id: string) => {
    try {
      const response = await apiClient.restartContainer(id);
      if (response.success) {
        // Refresh the container list to get current state
        await fetchContainers(true);
      }
      return response;
    } catch (error) {
      console.error('Failed to restart container:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const deleteContainer = async (id: string) => {
    try {
      const response = await apiClient.deleteContainer(id);
      if (response.success) {
        // Refresh the container list to get current state
        await fetchContainers(true);
      }
      return response;
    } catch (error) {
      console.error('Failed to delete container:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const refetch = useCallback(async () => {
    await fetchContainers(false); // Don't use background mode - show loading
  }, [fetchContainers]);

  return {
    containers,
    isLoading,
    error,
    refetch,
    startContainer,
    stopContainer,
    restartContainer,
    deleteContainer,
  };
}