'use client'

import { create } from 'zustand'

type BannerVariant = 'default' | 'sample_kept'

type OnboardingStore = {
  choiceModalOpen: boolean
  setChoiceModalOpen: (open: boolean) => void
  bannerVariant: BannerVariant
  setBannerVariant: (variant: BannerVariant) => void
  newClientDrawerOpen: boolean
  setNewClientDrawerOpen: (open: boolean) => void
  csvImportOpen: boolean
  setCsvImportOpen: (open: boolean) => void
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  choiceModalOpen: false,
  setChoiceModalOpen: (open) => set({ choiceModalOpen: open }),
  bannerVariant: 'default',
  setBannerVariant: (variant) => set({ bannerVariant: variant }),
  newClientDrawerOpen: false,
  setNewClientDrawerOpen: (open) => set({ newClientDrawerOpen: open }),
  csvImportOpen: false,
  setCsvImportOpen: (open) => set({ csvImportOpen: open }),
}))
