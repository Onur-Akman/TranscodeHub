import { Injectable } from '@angular/core';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

@Injectable({ providedIn: 'root' })
export class VoiceChatService {
  // Audio state
  voiceMode: 'OFF' | 'PTT' | 'ALWAYS_ON' = 'OFF';
  pttKey = 'Space';
  isMicActive = false;
  speakingUsers = new Map<string, boolean>();

  // Video state
  isCameraActive = false;
  localVideoStream: MediaStream | null = null;
  remoteVideoStreams = new Map<string, MediaStream>();

  private wsSend!: (msg: any) => void;
  private myUsername = '';
  private peers = new Map<string, RTCPeerConnection>();
  private audioElements = new Map<string, HTMLAudioElement>();
  private localAudioStream: MediaStream | null = null;
  private makingOffer = new Set<string>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();

  initialize(wsSend: (msg: any) => void, roomUsers: string[], myUsername: string) {
    this.wsSend = wsSend;
    this.myUsername = myUsername;

    const saved = localStorage.getItem('voiceSettings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.pttKey) this.pttKey = s.pttKey;
      } catch {}
    }

    for (const user of roomUsers) {
      if (user !== myUsername) this.createPeer(user, true);
    }
  }

  // ======================== AUDIO ========================

  async setMode(mode: 'OFF' | 'PTT' | 'ALWAYS_ON') {
    this.voiceMode = mode;

    if (mode === 'OFF') {
      this.stopMic();
    } else {
      if (!this.localAudioStream) await this.startMic();
      this.setMicEnabled(mode === 'ALWAYS_ON');
    }

    this.wsSend?.({ type: 'VOICE_STATE', mode, cameraEnabled: this.isCameraActive });
  }

  setPttKey(key: string) {
    this.pttKey = key;
    localStorage.setItem('voiceSettings', JSON.stringify({ pttKey: key }));
  }

  onPttDown() {
    if (this.voiceMode !== 'PTT') return;
    this.setMicEnabled(true);
  }

  onPttUp() {
    if (this.voiceMode !== 'PTT') return;
    this.setMicEnabled(false);
  }

  // ======================== VIDEO ========================

  async toggleCamera() {
    if (this.isCameraActive) {
      this.stopCamera();
    } else {
      await this.startCamera();
    }
    this.wsSend?.({ type: 'VOICE_STATE', mode: this.voiceMode, cameraEnabled: this.isCameraActive });
  }

  private async startCamera() {
    try {
      this.localVideoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      this.isCameraActive = true;

      for (const [, pc] of this.peers) {
        for (const track of this.localVideoStream.getVideoTracks()) {
          pc.addTrack(track, this.localVideoStream);
        }
      }
    } catch {
      this.isCameraActive = false;
      this.localVideoStream = null;
    }
  }

  private stopCamera() {
    if (this.localVideoStream) {
      this.localVideoStream.getTracks().forEach(t => t.stop());

      for (const [, pc] of this.peers) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) pc.removeTrack(sender);
      }

      this.localVideoStream = null;
    }
    this.isCameraActive = false;
  }

  // ======================== PEER LIFECYCLE ========================

  onUserJoined(username: string) {
    if (username === this.myUsername) return;
    this.createPeer(username, true);
  }

  onUserLeft(username: string) {
    this.removePeer(username);
  }

  handleSignalingMessage(msg: any) {
    const from = msg.fromUser;
    if (!from || from === this.myUsername) return;

    switch (msg.type) {
      case 'WEBRTC_OFFER': void this.handleOffer(from, msg.sdp); break;
      case 'WEBRTC_ANSWER': void this.handleAnswer(from, msg.sdp); break;
      case 'WEBRTC_ICE': void this.handleIceCandidate(from, msg.candidate); break;
    }
  }

  destroy() {
    this.stopMic();
    this.stopCamera();
    for (const [user] of this.peers) this.removePeer(user);
    this.peers.clear();
    this.speakingUsers.clear();
    this.remoteVideoStreams.clear();
  }

  // ======================== PRIVATE ========================

  private async startMic() {
    try {
      this.localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.localAudioStream.getAudioTracks().forEach(t => t.enabled = false);

      for (const [, pc] of this.peers) {
        for (const track of this.localAudioStream.getAudioTracks()) {
          const senders = pc.getSenders();
          if (!senders.find(s => s.track === track)) {
            pc.addTrack(track, this.localAudioStream);
          }
        }
      }
    } catch {
      this.voiceMode = 'OFF';
    }
  }

  private stopMic() {
    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach(t => t.stop());
      this.localAudioStream = null;
    }
    this.isMicActive = false;
  }

  private setMicEnabled(enabled: boolean) {
    this.isMicActive = enabled;
    this.localAudioStream?.getAudioTracks().forEach(t => t.enabled = enabled);
  }

  private createPeer(username: string, initiator: boolean) {
    if (this.peers.has(username)) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(username, pc);
    this.pendingCandidates.set(username, []);

    // Add local audio tracks
    if (this.localAudioStream) {
      for (const track of this.localAudioStream.getAudioTracks()) {
        pc.addTrack(track, this.localAudioStream);
      }
    }

    // Add local video tracks
    if (this.localVideoStream) {
      for (const track of this.localVideoStream.getVideoTracks()) {
        pc.addTrack(track, this.localVideoStream);
      }
    }

    // Handle remote tracks
    pc.ontrack = (e) => {
      if (e.track.kind === 'audio') {
        let audio = this.audioElements.get(username);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          this.audioElements.set(username, audio);
        }
        audio.srcObject = e.streams[0] || new MediaStream([e.track]);
      } else if (e.track.kind === 'video') {
        const stream = e.streams[0] || new MediaStream([e.track]);
        this.remoteVideoStreams.set(username, stream);
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.wsSend({
          type: 'WEBRTC_ICE',
          targetUser: username,
          candidate: e.candidate.toJSON()
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      if (this.makingOffer.has(username)) return;
      const imPolite = this.myUsername < username;
      if (!initiator && !imPolite) return;
      await this.sendOffer(username, pc);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        this.removePeer(username);
        setTimeout(() => this.createPeer(username, true), 2000);
      }
    };

    if (initiator) {
      void this.sendOffer(username, pc);
    }
  }

  private async sendOffer(username: string, pc: RTCPeerConnection) {
    try {
      this.makingOffer.add(username);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.wsSend({
        type: 'WEBRTC_OFFER',
        targetUser: username,
        sdp: pc.localDescription!.sdp
      });
    } catch {} finally {
      this.makingOffer.delete(username);
    }
  }

  private async handleOffer(from: string, sdp: string) {
    let pc = this.peers.get(from);
    if (!pc) {
      this.createPeer(from, false);
      pc = this.peers.get(from)!;
    }

    const imPolite = this.myUsername < from;

    if (!imPolite && pc.signalingState === 'have-local-offer') {
      return;
    }

    if (imPolite && pc.signalingState === 'have-local-offer') {
      await pc.setLocalDescription({ type: 'rollback' } as any);
    }

    await pc.setRemoteDescription({ type: 'offer', sdp });

    const pending = this.pendingCandidates.get(from) || [];
    for (const c of pending) {
      try { await pc.addIceCandidate(c); } catch {}
    }
    this.pendingCandidates.set(from, []);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.wsSend({
      type: 'WEBRTC_ANSWER',
      targetUser: from,
      sdp: pc.localDescription!.sdp
    });
  }

  private async handleAnswer(from: string, sdp: string) {
    const pc = this.peers.get(from);
    if (!pc) return;
    if (pc.signalingState !== 'have-local-offer') return;
    await pc.setRemoteDescription({ type: 'answer', sdp });

    const pending = this.pendingCandidates.get(from) || [];
    for (const c of pending) {
      try { await pc.addIceCandidate(c); } catch {}
    }
    this.pendingCandidates.set(from, []);
  }

  private async handleIceCandidate(from: string, candidate: RTCIceCandidateInit) {
    const pc = this.peers.get(from);
    if (!pc) return;

    if (pc.remoteDescription) {
      try { await pc.addIceCandidate(candidate); } catch {}
    } else {
      const pending = this.pendingCandidates.get(from) || [];
      pending.push(candidate);
      this.pendingCandidates.set(from, pending);
    }
  }

  private removePeer(username: string) {
    const pc = this.peers.get(username);
    if (pc) { pc.close(); this.peers.delete(username); }
    const audio = this.audioElements.get(username);
    if (audio) { audio.pause(); audio.srcObject = null; this.audioElements.delete(username); }
    this.remoteVideoStreams.delete(username);
    this.pendingCandidates.delete(username);
    this.speakingUsers.delete(username);
  }
}
