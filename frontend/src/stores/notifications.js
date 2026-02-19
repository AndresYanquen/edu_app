import { defineStore } from 'pinia'
import { getUnreadAnnouncementCount } from '../api/notifications'

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    unreadCount: 0,
  }),

  actions: {
    async refreshUnreadCount() {
      try {
        const data = await getUnreadAnnouncementCount()
        this.unreadCount = Number(data?.count || 0)
      } catch (err) {
        console.warn('Failed to refresh unread announcement count')
      }
    },

    setUnreadCount(value) {
      this.unreadCount = Math.max(0, Number(value || 0))
    },

    decrementUnread(step = 1) {
      this.unreadCount = Math.max(0, this.unreadCount - Number(step || 1))
    },
  },
})
