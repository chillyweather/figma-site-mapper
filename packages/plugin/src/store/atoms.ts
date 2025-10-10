import { atom } from 'jotai';
import { PluginSettings, BadgeLink } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

// Settings atoms
export const settingsAtom = atom<PluginSettings>(DEFAULT_SETTINGS);
export const currentViewAtom = atom<'main' | 'settings'>('main');

// Crawl state atoms
export const isLoadingAtom = atom(false);
export const statusAtom = atom('');
export const jobIdAtom = atom<string | null>(null);
export const authStatusAtom = atom<'idle' | 'authenticating' | 'success' | 'failed'>('idle');

// Flow mapping atoms
export const badgeLinksAtom = atom<BadgeLink[]>([]);
export const checkedLinksAtom = atom<Set<string>>(new Set());
