import React from 'react'

export const AuthAnimatedBackground: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden bg-[#f4f8ff]">
    <img
      src="/boxora-auth-background.png"
      alt=""
      className="auth-background-image absolute inset-0 h-full w-full object-cover object-center"
      loading="eager"
      decoding="async"
    />

    <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/10" />
    <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-transparent to-white/5" />
    <div className="auth-background-glow auth-background-glow-blue absolute -left-[12%] top-[5%] h-[38vw] w-[38vw] min-h-64 min-w-64 rounded-full" />
    <div className="auth-background-glow auth-background-glow-lime absolute -bottom-[24%] -right-[8%] h-[42vw] w-[42vw] min-h-72 min-w-72 rounded-full" />
  </div>
)

export default AuthAnimatedBackground
