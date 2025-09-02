import { Server, Socket } from 'socket.io'
import { verifyToken } from './auth'

export function setupSocketHandlers(io: Server) {
  const attemptNamespace = io.of('/attempt')

  attemptNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error('Authentication error'))
      }

      const user = verifyToken(token)
      socket.data.user = user
      next()
    } catch (err) {
      next(new Error('Authentication error'))
    }
  })

  attemptNamespace.on('connection', (socket: Socket) => {
    console.log(`User ${socket.data.user.userId} connected to attempt namespace`)

    socket.on('join-attempt', async (data: { attemptId: string; attemptToken: string }) => {
      console.log(`User joining attempt ${data.attemptId}`)
      socket.join(`attempt:${data.attemptId}`)
      
      socket.emit('start', {
        serverTime: Date.now(),
        attemptId: data.attemptId,
      })

      const tickInterval = setInterval(() => {
        socket.emit('tick', {
          serverTime: Date.now(),
        })
      }, 100)

      socket.on('disconnect', () => {
        clearInterval(tickInterval)
        console.log(`User ${socket.data.user.userId} disconnected from attempt namespace`)
      })
    })
  })
}