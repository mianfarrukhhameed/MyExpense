import { getPlatforms, isPlatform } from '@ionic/react'

export function isIosDevice(): boolean {
  return isPlatform('ios')
}

export function isAndroidDevice(): boolean {
  return isPlatform('android')
}

export function platformLabel(): string {
  const platforms = getPlatforms()
  if (platforms.includes('ios')) return 'iOS'
  if (platforms.includes('android')) return 'Android'
  return 'Web'
}
