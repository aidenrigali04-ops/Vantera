'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UIStore = {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (value: boolean) => void
  toggleSidebar: () => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (value: boolean) => void
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (value: boolean) => void
  recentRoutes: string[]
  pushRecentRoute: (route: string) => void
  selectedRecordIds: string[]
  setSelectedRecordIds: (ids: string[]) => void
  clearSelection: () => void
  selectedContactIds: string[]
  setSelectedContactIds: (ids: string[]) => void
  clearContactSelection: () => void
  recordsView: 'board' | 'calendar' | 'list'
  setRecordsView: (view: 'board' | 'calendar' | 'list') => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      mobileSidebarOpen: false,
      setMobileSidebarOpen: (value) => set({ mobileSidebarOpen: value }),
      commandPaletteOpen: false,
      setCommandPaletteOpen: (value) => set({ commandPaletteOpen: value }),
      recentRoutes: [],
      pushRecentRoute: (route) => {
        const filtered = get().recentRoutes.filter((r) => r !== route)
        set({ recentRoutes: [route, ...filtered].slice(0, 5) })
      },
      selectedRecordIds: [],
      setSelectedRecordIds: (ids) => set({ selectedRecordIds: ids }),
      clearSelection: () => set({ selectedRecordIds: [] }),
      selectedContactIds: [],
      setSelectedContactIds: (ids) => set({ selectedContactIds: ids }),
      clearContactSelection: () => set({ selectedContactIds: [] }),
      recordsView: 'board',
      setRecordsView: (view) => set({ recordsView: view }),
    }),
    {
      name: 'vantera-ui-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        recentRoutes: state.recentRoutes,
        recordsView: state.recordsView,
      }),
    },
  ),
)
