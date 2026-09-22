import { useState, useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'

const SC={beginner:'bg-green-100 text-green-700 border-green-200',intermediate:'bg-yellow-100 text-yellow-700 border-yellow-200',advanced:'bg-red-100 text-red-700 border-red-200'}
const SS={beginner:'BEG',intermediate:'INT',advanced:'ADV'}
const SKILL_ORDER={beginner:1,intermediate:2,advanced:3}

function loadMem(){try{const s=localStorage.getItem('op_mem');return s?JSON.parse(s):{sessions:[],currentSession:1,stats:{},history:[],removed:{},lastFinished:{},recentOpponents:{},lastResult:{}}}catch{return{sessions:[],currentSession:1,stats:{},history:[],removed:{},lastFinished:{},recentOpponents:{},lastResult:{}}}}
function saveMem(){try{localStorage.setItem('op_mem',JSON.stringify(mem))}catch{}}
const mem=loadMem()
if(!mem.lastResult)mem.lastResult={} // guard for op_mem saved before this key existed

function ago(iso){const m=Math.floor((Date.now()-new Date(iso).getTime())/60000);return m<1?'just now':m<60?m+'m ago':Math.floor(m/60)+'h '+(m%60?m%60+'m':'')}
function wr(s){const g=(s.wins||0)+(s.losses||0);return g?Math.round((s.wins||0)/g*100):0}
function fmtTime(iso){return new Date(iso).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}
function elapsed(iso){return iso?Math.floor((Date.now()-new Date(iso).getTime())/60000):0}

function suggestionPriority(p,stats,now){
  const t=mem.lastFinished[p.id]||new Date(p.check_in_at).getTime()
  const wait=now-t
  // Players with fewer total games get priority bonus
  const games=(stats[p.id]?.wins||0)+(stats[p.id]?.losses||0)+(stats[p.id]?.draws||0)
  return wait-games*60000 // each game adds 1min penalty
}

function getSuggestions(waiting,stats,pairs){
  const now=Date.now()
  if(waiting.length===0)return []
  // The single longest-waiting player anchors this batch of suggestions. If they have a
  // known win/loss result, players who share it are favored for the remaining "Next" spots
  // — same weighting as the per-court suggestion ranking — so a winner-heavy or loser-heavy
  // batch naturally surfaces together here too, not just once a court already has players on
  // it. A player who's waited much longer still isn't shut out entirely: the penalty just
  // costs them a few minutes of priority, it doesn't remove them from consideration.
  const anchor=[...waiting].sort((a,b)=>suggestionPriority(b,stats,now)-suggestionPriority(a,stats,now))[0]
  const anchorStatus=mem.lastResult[anchor.id]||null
  // Fixed pairs need to be treated as one unit here too — same as every other place a player
  // can be suggested for a court — otherwise this list can show one half of a pair as if they
  // were a normal solo "next" candidate, when assigning them for real would actually also need
  // their partner's slot. A pair only counts as ready once BOTH are free/waiting, and its
  // priority/win-loss-mismatch use the less-ready of the two so the pair doesn't look more
  // overdue than it actually is.
  const seen=new Set()
  const scored=[]
  for(const p of waiting){
    if(seen.has(p.id))continue
    const partnerId=(pairs||[]).find(pr=>pr.includes(p.id))?.find(id=>id!==p.id)
    const partner=partnerId?waiting.find(w=>w.id===partnerId):null
    if(partner)seen.add(partner.id)
    seen.add(p.id)
    const needed=partner?2:1
    const priority=partner?Math.min(suggestionPriority(p,stats,now),suggestionPriority(partner,stats,now)):suggestionPriority(p,stats,now)
    const pMismatch=(anchorStatus&&mem.lastResult[p.id]&&mem.lastResult[p.id]!==anchorStatus)?1:0
    const partnerMismatch=(partner&&anchorStatus&&mem.lastResult[partner.id]&&mem.lastResult[partner.id]!==anchorStatus)?1:0
    const mismatch=Math.max(pMismatch,partnerMismatch)
    scored.push({p,partner,needed,score:priority-mismatch*240000})
  }
  scored.sort((a,b)=>b.score-a.score)
  // Same batch-compatibility rule as each court's own "Next up" box: never let this general
  // recommendation put a Beginner and an Advanced player in the same top-4 batch, so it can't imply
  // a pairing that a court's own suggestion box would refuse to offer. Skip (don't stop on) a
  // conflicting candidate so a later, compatible one still gets a chance to fill the spot. A pair
  // that wouldn't fit in the remaining "slots" is skipped the same way, same as a court's own box.
  const picks=[]
  const simSkills=new Set()
  let room=4
  for(const s of scored){
    if(s.needed>room)continue
    const candSkills=s.partner?[s.p.skill_level,s.partner.skill_level]:[s.p.skill_level]
    const wouldHave=new Set([...simSkills,...candSkills])
    if(wouldHave.has('beginner')&&wouldHave.has('advanced'))continue
    picks.push(s.p)
    if(s.partner)picks.push(s.partner)
    room-=s.needed
    candSkills.forEach(sk=>simSkills.add(sk))
    if(room<=0)break
  }
  return picks
}

// Beginners and Advanced players are never put in the same match — it's not a good game for
// either side. Intermediate is the bridge: Beginner↔Intermediate and Intermediate↔Advanced are
// both fine, same-skill matches are always fine, but a court (or a fixed pair) must never end up
// with both a Beginner and an Advanced on it at once.
function skillPairOk(a,b){return !((a==='beginner'&&b==='advanced')||(a==='advanced'&&b==='beginner'))}
function courtAllowsSkills(courtPlayers,newSkills){
  const skills=new Set([...courtPlayers.map(p=>p.skill_level),...newSkills])
  return !(skills.has('beginner')&&skills.has('advanced'))
}

function suggestTeams(courtPlayers,pairs){
  // Try every way to split the 4 court players into two teams of 2, and pick the one that (a)
  // keeps a fixed pair together on the same team if one of them is on this court, (b) has played
  // each other the least recently (mem.recentOpponents), so the same two people aren't teamed up
  // or matched against each other again right away, and (c) is otherwise the most skill-balanced.
  const ids=courtPlayers.map(p=>p.id)
  const lockedPair=(pairs||[]).find(pr=>pr.every(id=>ids.includes(id)))
  const splits=[[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]].map(([i1,i2])=>({
    t1:i1.map(i=>courtPlayers[i]).filter(Boolean),
    t2:i2.map(i=>courtPlayers[i]).filter(Boolean),
  }))
  const valid=lockedPair
    ? splits.filter(s=>s.t1.some(p=>p.id===lockedPair[0])===s.t1.some(p=>p.id===lockedPair[1]))
    : splits
  const pool=valid.length>0?valid:splits
  function skillSum(team){return team.reduce((s,p)=>s+(SKILL_ORDER[p.skill_level]||1),0)}
  function recentCount(t1,t2){
    const pairsToCheck=[[t1[0],t1[1]],[t2[0],t2[1]],[t1[0],t2[0]],[t1[0],t2[1]],[t1[1],t2[0]],[t1[1],t2[1]]]
    return pairsToCheck.reduce((n,[a,b])=>n+((a&&b&&(mem.recentOpponents[a.id]||[]).includes(b.id))?1:0),0)
  }
  const scored=pool.map(s=>({...s,recent:recentCount(s.t1,s.t2),skillDiff:Math.abs(skillSum(s.t1)-skillSum(s.t2))}))
    .sort((a,b)=>(a.recent-b.recent)||(a.skillDiff-b.skillDiff))
  const best=scored[0]
  return{t1:best.t1,t2:best.t2}
}

export function OpenPlayScreen(){
  const session=useSessionStore(s=>s.session)
  const [players,setPlayers]=useState(()=>{try{const s=localStorage.getItem('op_players');return s?JSON.parse(s):[]}catch{return[]}})
  const [courts,setCourts]=useState(()=>{try{const s=localStorage.getItem('op_courts');return s?JSON.parse(s):{'Court 1':[],'Court 2':[]}}catch{return{'Court 1':[],'Court 2':[]}}})
  const [stats,setStats]=useState(mem.stats||{})
  const [rec,setRec]=useState(null)
  const [winner,setWinner]=useState(null)
  const [tab,setTab]=useState('play')
  const [name,setName]=useState('')
  const [skill,setSkill]=useState('beginner')
  const [removing,setRemoving]=useState(null)
  // Players a staffer has set aside — excluded from Waiting/suggestions until resumed.
  // Purely local (like op_players/op_courts) since there's no server-side concept of this.
  const [pausedIds,setPausedIds]=useState(()=>{try{const s=localStorage.getItem('op_paused');return s?JSON.parse(s):[]}catch{return[]}})
  // Fixed partners — an array of [idA, idB] tuples. When either partner is assigned to a
  // court (and the other is currently free/waiting), both go together, always as teammates.
  // Purely local, same as pausedIds — there's no server-side concept of this.
  const [pairs,setPairs]=useState(()=>{try{const s=localStorage.getItem('op_pairs');return s?JSON.parse(s):[]}catch{return[]}})
  const [pairPickerFor,setPairPickerFor]=useState(null)
  const [confirmReset,setConfirmReset]=useState(false)
  const [confirmNew,setConfirmNew]=useState(false)
  const [sessionNum,setSessionNum]=useState(mem.currentSession||1)
  const [sessionStart,setSessionStart]=useState(new Date().toISOString())
  const [sessionSkill,setSessionSkill]=useState('all')
  const [showSkillPicker,setShowSkillPicker]=useState(false)
  const [tick,setTick]=useState(0)
  const [dragPlayer,setDragPlayer]=useState(null)
  const [teams,setTeams]=useState({'Court 1':{t1:[],t2:[]},'Court 2':{t1:[],t2:[]}})
  const [showTeamPicker,setShowTeamPicker]=useState(null)
  const [teamDrag,setTeamDrag]=useState(null)
  const timerRef=useRef(null)

  useEffect(()=>{
    timerRef.current=setInterval(()=>setTick(n=>n+1),30000)
    return ()=>clearInterval(timerRef.current)
  },[])

  useEffect(()=>{
    if(!session)return
    const saved=localStorage.getItem('op_players')
    if(saved&&JSON.parse(saved).length>0)return
    window.electronAPI.listOpenPlayToday(session.branch_id).then(list=>{
      const c1=list.filter(p=>p.court_assigned==='court_1'&&!p.checked_out_at)
      const c2=list.filter(p=>p.court_assigned==='court_2'&&!p.checked_out_at)
      setPlayers(list)
      setCourts({'Court 1':c1,'Court 2':c2})
      localStorage.setItem('op_players',JSON.stringify(list))
      localStorage.setItem('op_courts',JSON.stringify({'Court 1':c1,'Court 2':c2}))
    })
  },[session])

  const onCourtIds=new Set([...courts['Court 1'],...courts['Court 2']].map(p=>p.id))
  const pausedSet=new Set(pausedIds)
  // Paused players are set aside — excluded from Waiting, never suggested/called for a
  // court — until a staffer taps Resume on them.
  const waiting=players.filter(p=>!onCourtIds.has(p.id)&&!mem.removed[p.id]&&!pausedSet.has(p.id))
  const pausedPlayers=players.filter(p=>!onCourtIds.has(p.id)&&!mem.removed[p.id]&&pausedSet.has(p.id))
  const onCourt=courts['Court 1'].length+courts['Court 2'].length
  const suggestions=getSuggestions(waiting,stats,pairs)
  const sortedWaiting=[...waiting].sort((a,b)=>{
    const _now=Date.now()
    const aL=mem.lastFinished[a.id]||new Date(a.check_in_at).getTime()
    const bL=mem.lastFinished[b.id]||new Date(b.check_in_at).getTime()
    return(_now-bL)-(_now-aL)
  })
  const allowedSkills=sessionSkill==='beginner'?['beginner']:sessionSkill==='intadv'?['intermediate','advanced']:['beginner','intermediate','advanced']

  function partnerIdOf(id){const pr=pairs.find(p=>p.includes(id));return pr?pr.find(x=>x!==id):null}
  function savePairs(next){setPairs(next);localStorage.setItem('op_pairs',JSON.stringify(next))}
  function makePair(aId,bId){
    // Replace any existing pairing either of them was in — a player can only have one fixed
    // partner at a time.
    savePairs([...pairs.filter(p=>!p.includes(aId)&&!p.includes(bId)),[aId,bId]])
    setPairPickerFor(null)
  }
  function unpair(id){savePairs(pairs.filter(p=>!p.includes(id)))}

  // What's stopping `p` from being assigned to `court` right now, if anything — checked before
  // every assign (button, drag) and used to disable/explain the Assign buttons in the UI. A
  // fixed pair needs 2 open slots (they're never split across courts), and Beginner/Advanced can
  // never end up together on the same court.
  function assignBlockReason(p,court){
    const cp=courts[court]
    const partnerId=partnerIdOf(p.id)
    const partner=partnerId?waiting.find(w=>w.id===partnerId):null
    const needed=partner?2:1
    if((4-cp.length)<needed)return partner?'Needs 2 open slots — fixed pair':'Court full'
    const newSkills=partner?[p.skill_level,partner.skill_level]:[p.skill_level]
    if(!courtAllowsSkills(cp,newSkills))return "Beginner & Advanced can't share a court"
    return null
  }

  // A court's "winner status" — 'win' if everyone currently on it just won their last game,
  // 'loss' if everyone just lost, or null if it's empty, mixed, or nobody there has a result
  // yet. Used by courtSuggestions to nudge winners toward winners and losers toward losers.
  function courtWinnerStatus(courtPlayers){
    const known=courtPlayers.map(cpP=>mem.lastResult[cpP.id]).filter(Boolean)
    if(known.length===0)return null
    return known.every(r=>r===known[0])?known[0]:null
  }
  function candidateWinnerStatus(p,partner){
    const a=mem.lastResult[p.id]
    if(!partner)return a||null
    const b=mem.lastResult[partner.id]
    return(a&&b&&a===b)?a:null
  }

  // Per-court "next up" candidates: skill-compatible with what's already on THIS court, a fixed
  // pair brought along as one unit, and ranked by the same wait-time/game-count priority as
  // getSuggestions() but with a penalty for players who've recently played the people already on
  // this court — so the same faces don't keep getting rotated back in against each other — and a
  // separate penalty for players whose last result doesn't match the court's winner/loser status,
  // so players who just won tend to get matched with other recent winners (and losers with
  // losers), keeping games competitive and naturally mixing up who plays whom.
  function courtSuggestions(court){
    const cp=courts[court]
    const now=Date.now()
    const courtStatus=courtWinnerStatus(cp)
    const seen=new Set()
    const out=[]
    for(const p of waiting){
      if(seen.has(p.id))continue
      const partnerId=partnerIdOf(p.id)
      const partner=partnerId?waiting.find(w=>w.id===partnerId):null
      if(partner)seen.add(partner.id)
      seen.add(p.id)
      const needed=partner?2:1
      if(needed>(4-cp.length))continue
      if(!courtAllowsSkills(cp,partner?[p.skill_level,partner.skill_level]:[p.skill_level]))continue
      const aTime=mem.lastFinished[p.id]||new Date(p.check_in_at).getTime()
      const bTime=partner?(mem.lastFinished[partner.id]||new Date(partner.check_in_at).getTime()):aTime
      const readyAt=Math.max(aTime,bTime) // a pair only counts as "waiting" once BOTH are free
      const wait=now-readyAt
      const gs=(stats[p.id]?.wins||0)+(stats[p.id]?.losses||0)+(stats[p.id]?.draws||0)
      const gamePenalty=gs*60000
      const overlap=cp.reduce((n,cpP)=>{
        const a=(mem.recentOpponents[p.id]||[]).includes(cpP.id)?1:0
        const b=partner&&(mem.recentOpponents[partner.id]||[]).includes(cpP.id)?1:0
        return n+a+b
      },0)
      const candStatus=candidateWinnerStatus(p,partner)
      const winnerMismatch=(courtStatus&&candStatus&&candStatus!==courtStatus)?1:0
      out.push({p,partner,needed,score:(wait-gamePenalty)-overlap*180000-winnerMismatch*240000})
    }
    return out.sort((a,b)=>b.score-a.score)
  }

  async function register(){
    if(!name.trim()||!session)return
    if(!allowedSkills.includes(skill))return
    const r=await window.electronAPI.registerOpenPlay({branch_id:session.branch_id,player_name:name.trim(),skill_level:skill,play_date:new Date().toISOString().slice(0,10),court_assigned:undefined,transaction_id:undefined})
    setPlayers(p=>{const n=[...p,r];localStorage.setItem('op_players',JSON.stringify(n));return n});setName('')
  }

  async function assign(player,court){
    // Bring a fixed partner along automatically, as long as they're actually free right now —
    // if they're paused, already on a court, or not registered, fall back to assigning `player`
    // alone rather than silently ignoring the tap.
    const partnerId=partnerIdOf(player.id)
    const partner=partnerId?waiting.find(w=>w.id===partnerId):null
    if(assignBlockReason(player,court))return
    const key=court==='Court 1'?'court_1':'court_2'
    const toAssign=partner?[player,partner]:[player]
    for(const p of toAssign){await window.electronAPI.assignCourt(p.id,key)}
    const existing=courts[court]
    existing.forEach(cp=>{
      toAssign.forEach(p=>{
        mem.recentOpponents[p.id]=[...(mem.recentOpponents[p.id]||[]),cp.id].slice(-12)
        mem.recentOpponents[cp.id]=[...(mem.recentOpponents[cp.id]||[]),p.id].slice(-12)
      })
    })
    const now=new Date().toISOString()
    const toAssignIds=new Set(toAssign.map(p=>p.id))
    setPlayers(p=>{const n=p.map(x=>toAssignIds.has(x.id)?{...x,court_assigned:key,checked_out_at:null}:x);localStorage.setItem('op_players',JSON.stringify(n));return n})
    setCourts(c=>{
      const updated={...c,[court]:[...c[court],...toAssign.map(p=>({...p,court_assigned:key,checked_out_at:null,court_start_time:now}))]}
      if(updated[court].length===4){const suggested=suggestTeams(updated[court],pairs);setTeams(t=>({...t,[court]:suggested}))}
      localStorage.setItem('op_courts',JSON.stringify(updated))
      return updated
    })
    saveMem()
  }

  async function donePlayer(player){
    await window.electronAPI.checkOutPlayer(player.id)
    mem.lastFinished[player.id]=Date.now()+Math.floor(Math.random()*10000)
    const court=player.court_assigned==='court_1'?'Court 1':'Court 2'
    setCourts(c=>{const n={...c,[court]:c[court].filter(p=>p.id!==player.id)};localStorage.setItem('op_courts',JSON.stringify(n));return n})
    setPlayers(p=>{const n=p.map(x=>x.id===player.id?{...x,court_assigned:null,checked_out_at:null}:x);localStorage.setItem('op_players',JSON.stringify(n));return n})
    saveMem()
  }

  function removePlayer(p){
    mem.removed[p.id]=true
    setPlayers(prev=>{const n=prev.filter(x=>x.id!==p.id);localStorage.setItem('op_players',JSON.stringify(n));return n})
    setCourts(c=>{const n={'Court 1':c['Court 1'].filter(x=>x.id!==p.id),'Court 2':c['Court 2'].filter(x=>x.id!==p.id)};localStorage.setItem('op_courts',JSON.stringify(n));return n})
    setPausedIds(ids=>{const n=ids.filter(id=>id!==p.id);localStorage.setItem('op_paused',JSON.stringify(n));return n})
    savePairs(pairs.filter(pr=>!pr.includes(p.id)))
    setRemoving(null)
  }

  function pausePlayer(p){
    setPausedIds(ids=>{const n=ids.includes(p.id)?ids:[...ids,p.id];localStorage.setItem('op_paused',JSON.stringify(n));return n})
  }

  function resumePlayer(p){
    setPausedIds(ids=>{const n=ids.filter(id=>id!==p.id);localStorage.setItem('op_paused',JSON.stringify(n));return n})
  }

  function endSession(startNew){
    mem.sessions.push({num:sessionNum,start:sessionStart,end:new Date().toISOString(),playerCount:players.length,players:players.map(p=>p.player_name),games:mem.history.filter(g=>g.sessionNum===sessionNum).length})
    mem.removed={};mem.lastFinished={};mem.recentOpponents={};mem.lastResult={};saveMem();saveMem()
    if(startNew){const next=sessionNum+1;mem.currentSession=next;setSessionNum(next);setSessionStart(new Date().toISOString())}
    setPlayers([]);setCourts({'Court 1':[],'Court 2':[]});setPausedIds([]);setPairs([])
    localStorage.setItem('op_players','[]');localStorage.setItem('op_courts',JSON.stringify({'Court 1':[],'Court 2':[]}));localStorage.setItem('op_paused','[]');localStorage.setItem('op_pairs','[]')
    setRec(null);setConfirmReset(false);setConfirmNew(false);setShowSkillPicker(true)
  }

  // Recording a result means the game on that court is over, so every player who was on
  // it — not just the two teams that were tracked for the score — is automatically
  // checked out (same as tapping "Done" on each of them individually) once the score is
  // saved. Saves Louise from having to record the result and then separately tap Done on
  // every player on that court.
  async function recordResult(t1ids,t2ids,cp){
    if(!winner)return
    const ns={...stats}
    ;[...t1ids,...t2ids].forEach(id=>{if(!ns[id])ns[id]={wins:0,losses:0,draws:0,name:players.find(p=>p.id===id)?.player_name||'?'}})
    t1ids.forEach(id=>{mem.recentOpponents[id]=[...(mem.recentOpponents[id]||[]),...t2ids].slice(-12)})
    t2ids.forEach(id=>{mem.recentOpponents[id]=[...(mem.recentOpponents[id]||[]),...t1ids].slice(-12)})
    if(winner==='draw'){[...t1ids,...t2ids].forEach(id=>{ns[id].draws=(ns[id].draws||0)+1;delete mem.lastResult[id]})}
    else{
      const w=winner==='t1'?t1ids:t2ids;const l=winner==='t1'?t2ids:t1ids
      // Remember who just won and who just lost — courtSuggestions uses this to favor
      // matching winners with other recent winners (and losers with losers) next.
      w.forEach(id=>{ns[id].wins=(ns[id].wins||0)+1;mem.lastResult[id]='win'})
      l.forEach(id=>{ns[id].losses=(ns[id].losses||0)+1;mem.lastResult[id]='loss'})
    }
    mem.history.push({id:Date.now(),date:new Date().toISOString(),sessionNum,t1:t1ids.map(id=>({id,name:ns[id]?.name})),t2:t2ids.map(id=>({id,name:ns[id]?.name})),winner})
    mem.stats=ns;setStats(ns);setRec(null);setWinner(null);saveMem();saveMem()
    for(const p of cp||[]){await donePlayer(p)}
  }

  function onDragStart(p){setDragPlayer(p)}
  function onDragOver(e){e.preventDefault()}
  function onDropCourt(e,court){
    e.preventDefault()
    if(!dragPlayer)return
    if(onCourtIds.has(dragPlayer.id))return
    if(assignBlockReason(dragPlayer,court))return
    assign(dragPlayer,court)
    setDragPlayer(null)
  }
  function onTeamDragStart(p,team){setTeamDrag({p,team})}
  function onTeamDrop(e,court,toTeam){
    e.preventDefault()
    if(!teamDrag)return
    const{p,team:fromTeam}=teamDrag
    if(fromTeam===toTeam)return
    setTeams(t=>{
      const from=t[court][fromTeam].filter(x=>x.id!==p.id)
      const to=[...t[court][toTeam],p]
      return{...t,[court]:{...t[court],[fromTeam]:from,[toTeam]:to}}
    })
    setTeamDrag(null)
  }

  const ranked=Object.entries(stats).filter(([,s])=>(s.wins||0)+(s.losses||0)>0).map(([id,s])=>({id,...s,score:(s.wins||0)*3+((s.wins||0)+(s.losses||0))*0.5+wr(s)*0.3})).sort((a,b)=>b.score-a.score)
  const potw=ranked.find(p=>((p.wins||0)+(p.losses||0))>=3)
  const skillLabel=sessionSkill==='beginner'?'BEG Only':sessionSkill==='intadv'?'INT + ADV':'All Levels'
  const skillColor=sessionSkill==='beginner'?'bg-green-500':sessionSkill==='intadv'?'bg-yellow-500':'bg-dg'

  return (
    <div className='h-full overflow-y-auto bg-cream'>
      <div className='sticky top-0 bg-cream border-b border-border px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2 z-10'>
        <div>
          <div className='flex items-center gap-2 flex-wrap'>
            <h1 className='text-lg font-medium text-dg'>Open Play</h1>
            <span className='text-xs bg-dg text-white px-2 py-0.5 rounded-full font-medium'>Session {sessionNum}</span>
            <span className='text-xs text-gray-400'>{fmtTime(sessionStart)}</span>
            <button onClick={()=>setShowSkillPicker(true)} className={'text-xs text-white px-2 py-0.5 rounded-full font-medium '+skillColor}>{skillLabel} ▾</button>
          </div>
          <p className='text-xs text-gray-500'>{new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric'})}</p>
        </div>
        <div className='flex items-center gap-2 flex-wrap'>
          <div className='flex gap-3 text-center mr-1'>
            <div><div className='text-base font-medium text-dg'>{players.length}</div><div className='text-xs text-gray-400'>Players</div></div>
            <div><div className='text-base font-medium text-olive'>{onCourt}</div><div className='text-xs text-gray-400'>On court</div></div>
            <div><div className='text-base font-medium text-maroon'>{waiting.length}</div><div className='text-xs text-gray-400'>Waiting</div></div>
            {pausedPlayers.length>0&&<div><div className='text-base font-medium text-gray-400'>{pausedPlayers.length}</div><div className='text-xs text-gray-400'>Paused</div></div>}
          </div>
          <button onClick={()=>setConfirmNew(true)} className='px-3 py-1.5 rounded-lg bg-olive text-white text-xs font-medium flex items-center gap-1'><i className='ti ti-plus'/>New Session</button>
          <button onClick={()=>setConfirmReset(true)} className='px-3 py-1.5 rounded-lg border border-border bg-white text-xs text-gray-600 flex items-center gap-1'><i className='ti ti-refresh'/>Reset</button>
          <div className='flex rounded-lg border border-border overflow-hidden ml-1'>
            {[['play','Play'],['lb','Leaderboard'],['history','Sessions']].map(([v,l])=>(
              <button key={v} onClick={()=>setTab(v)} className={'px-3 py-1.5 text-xs font-medium '+(tab===v?'bg-dg text-white':'bg-white text-gray-600')}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {tab==='play'&&(
        <div className='p-4 grid grid-cols-1 lg:grid-cols-3 gap-4'>
          <div className='space-y-4'>
            <div className='bg-white rounded-xl border border-border p-4'>
              <div className='text-sm font-medium text-dg mb-3'>Register player</div>
              <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&register()} placeholder='Player name' className='w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:border-olive mb-2'/>
              <div className='grid grid-cols-3 gap-1.5 mb-2'>
                {['beginner','intermediate','advanced'].map(s=>{
                  const allowed=allowedSkills.includes(s)
                  return(
                    <button key={s} onClick={()=>allowed&&setSkill(s)} className={'py-1.5 rounded-lg border text-xs font-medium '+(skill===s&&allowed?SC[s]+' border-current':allowed?'border-border text-gray-500':'border-border text-gray-300 opacity-40 cursor-not-allowed')}>{SS[s]}</button>
                  )
                })}
              </div>
              {!allowedSkills.includes(skill)&&<p className='text-xs text-orange-500 mb-2'>Not allowed in this session</p>}
              <button onClick={register} disabled={!name.trim()||!allowedSkills.includes(skill)} className='w-full py-2 bg-dg text-white text-sm font-medium rounded-lg disabled:opacity-40'>Add Player</button>
            </div>
            <div className='bg-white rounded-xl border border-border p-4'>
              <div className='text-sm font-medium text-dg mb-1 flex items-center justify-between'>
                Waiting <span className='text-xs bg-dg text-white px-2 py-0.5 rounded-full'>{waiting.length}</span>
              </div>
              <div className='text-xs text-gray-400 mb-2 flex items-center gap-1'><i className='ti ti-clock text-olive text-xs'/>Longest rest plays next · Tap C1/C2 to assign (or drag, on a mouse)</div>
              {sortedWaiting.length===0?(
                <p className='text-xs text-gray-400 text-center py-3'>No players waiting</p>
              ):sortedWaiting.map((p,i)=>{
                const lastDone=mem.lastFinished[p.id]
                const gs=(stats[p.id]?.wins||0)+(stats[p.id]?.losses||0)
                const isSug1=suggestions.some(s=>s.id===p.id)
                const isSug2=false
                const partnerId=partnerIdOf(p.id)
                const partnerName=partnerId?players.find(x=>x.id===partnerId)?.player_name:null
                const c1Reason=assignBlockReason(p,'Court 1')
                const c2Reason=assignBlockReason(p,'Court 2')
                return(
                  <div key={p.id} draggable onDragStart={()=>onDragStart(p)} className={'flex items-center gap-2 py-1.5 border-b border-border last:border-0 px-1 rounded-lg cursor-grab '+(isSug1?'bg-green-50':isSug2?'bg-blue-50':'')}>
                    <div className='w-5 h-5 rounded-full bg-surface text-xs flex items-center justify-center text-dg font-medium flex-shrink-0'>{i+1}</div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-1'>
                        <span className='text-xs font-medium text-dg truncate'>{p.player_name}</span>
                        {isSug1&&<span className='text-xs bg-olive text-white px-1 rounded flex-shrink-0'>Next</span>}

                      </div>
                      <div className='text-xs text-gray-400'>{lastDone?'Rested '+ago(new Date(lastDone).toISOString()):'Joined '+ago(p.check_in_at)} · {gs} game{gs!==1?'s':''}</div>
                    </div>
                    <span className={'text-xs px-1 py-0.5 rounded border mr-1 '+SC[p.skill_level]}>{SS[p.skill_level]}</span>
                    {mem.lastResult[p.id]==='win'&&<span title='Won their last game' className='text-xs px-1 py-0.5 rounded border mr-1 bg-emerald-50 text-emerald-700 border-emerald-200'>🏆 W</span>}
                    {mem.lastResult[p.id]==='loss'&&<span title='Lost their last game' className='text-xs px-1 py-0.5 rounded border mr-1 bg-gray-50 text-gray-500 border-gray-200'>L</span>}
                    {partnerId?(
                      <button onClick={()=>unpair(p.id)} title={'Fixed partner: '+(partnerName||'?')+' — tap to unpair'} className='text-xs px-1.5 py-1 rounded-md bg-purple-100 text-purple-700 font-medium flex items-center gap-1 mr-1 max-w-[64px]'>
                        <i className='ti ti-link text-xs flex-shrink-0'/><span className='truncate'>{partnerName?partnerName.split(' ')[0]:'?'}</span>
                      </button>
                    ):(
                      <button onClick={()=>setPairPickerFor(p)} title='Set a fixed partner' className='text-gray-300 hover:text-purple-500 text-xs p-0.5 mr-1'><i className='ti ti-link'/></button>
                    )}
                    {/* Tap-to-assign — HTML5 drag doesn't work via touch on iPad, so this is the primary way to assign on tablet. */}
                    <div className='flex items-center gap-1 mr-1'>
                      <button onClick={()=>assign(p,'Court 1')} disabled={!!c1Reason} title={c1Reason||'Assign to Court 1'}
                        className='text-xs px-1.5 py-1 rounded-md bg-dg/10 text-dg font-medium hover:bg-dg/20 disabled:opacity-30 disabled:cursor-not-allowed'>C1</button>
                      <button onClick={()=>assign(p,'Court 2')} disabled={!!c2Reason} title={c2Reason||'Assign to Court 2'}
                        className='text-xs px-1.5 py-1 rounded-md bg-dg/10 text-dg font-medium hover:bg-dg/20 disabled:opacity-30 disabled:cursor-not-allowed'>C2</button>
                    </div>
                    <button onClick={()=>pausePlayer(p)} title='Pause — skip calling them for a while' className='text-gray-300 hover:text-orange-400 text-xs p-0.5'><i className='ti ti-player-pause'/></button>
                    <button onClick={()=>setRemoving(p)} className='text-gray-300 hover:text-red-400 text-xs p-0.5'><i className='ti ti-x'/></button>
                  </div>
                )
              })}
            </div>
            {pausedPlayers.length>0&&(
              <div className='bg-white rounded-xl border border-border p-4'>
                <div className='text-sm font-medium text-dg mb-1 flex items-center justify-between'>
                  Paused <span className='text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full'>{pausedPlayers.length}</span>
                </div>
                <div className='text-xs text-gray-400 mb-2'>Set aside — won't be suggested or called for a court until resumed</div>
                {pausedPlayers.map(p=>(
                  <div key={p.id} className='flex items-center gap-2 py-1.5 border-b border-border last:border-0 px-1'>
                    <div className='flex-1 min-w-0'>
                      <span className='text-xs font-medium text-dg truncate'>{p.player_name}</span>
                    </div>
                    <span className={'text-xs px-1 py-0.5 rounded border mr-1 '+SC[p.skill_level]}>{SS[p.skill_level]}</span>
                    <button onClick={()=>resumePlayer(p)} title='Resume — make them callable again' className='text-xs px-2 py-1 rounded-md bg-olive text-white font-medium flex items-center gap-1'><i className='ti ti-player-play'/>Resume</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className='lg:col-span-2 space-y-4'>
            <div className='bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700'>
              <strong>Fair rotation:</strong> Tap C1/C2 (or drag, on a mouse) to assign a waiting player. Game stops only when YOU tap Done.
              Beginners and Advanced players are never matched together, and fixed partners always join the same court as a team.
              Players who just won tend to get suggested onto courts with other recent winners (🏆), same for recent losers, so results stay competitive and matchups keep mixing up.
            </div>
            {['Court 1','Court 2'].map(court=>{
              const cp=courts[court]
              const sug=courtSuggestions(court)
              const startTime=cp[0]?.court_start_time
              const mins=elapsed(startTime)
              const isC1=court==='Court 1'
              const courtTeams=teams[court]
              const hasTeams=courtTeams.t1.length>0||courtTeams.t2.length>0
              return(
                <div key={court} className='bg-white rounded-xl border border-border overflow-hidden' onDragOver={onDragOver} onDrop={e=>onDropCourt(e,court)}>
                  <div className={'px-4 py-3 border-b border-border flex items-center justify-between '+(cp.length?'bg-dg':'bg-surface')}>
                    <div className='flex items-center gap-3'>
                      <div>
                        <div className={'text-sm font-medium '+(cp.length?'text-white':'text-dg')}>{court}</div>
                        <div className={'text-xs '+(cp.length?'text-white/60':'text-gray-500')}>{cp.length?cp.length+'/4 players':'Available — drop players here'}</div>
                      </div>
                      {startTime&&(
                        <div className={'text-center px-3 py-1 rounded-lg '+(mins>=15?'bg-red-500':mins>=10?'bg-orange-400':'bg-white/20')}>
                          <div className={'text-lg font-bold '+(cp.length?'text-white':'text-dg')}>{elapsed(startTime)}</div>
                          <div className={'text-xs '+(cp.length?'text-white/60':'text-gray-500')}>min</div>
                        </div>
                      )}
                    </div>
                    <div className='flex items-center gap-2'>
                      {cp.length>=2&&<button onClick={()=>setShowTeamPicker(court)} className='text-xs px-2 py-1 rounded bg-white/20 text-white font-medium border border-white/30'>Set Teams</button>}
                      {cp.length>=2&&<button onClick={()=>{setRec({court,cp,t1:courtTeams.t1,t2:courtTeams.t2});setWinner(null)}} className='text-xs px-2 py-1 rounded bg-yellow-400 text-yellow-900 font-medium'>Record result</button>}
                    </div>
                  </div>
                  <div className='p-3 space-y-2'>
                    {cp.length>0&&(
                      <div>
                        {hasTeams&&cp.length===4?(
                          <div className='grid grid-cols-2 gap-2 mb-2'>
                            {['t1','t2'].map((team,ti)=>(
                              <div key={team} className={'rounded-lg border p-2 '+(ti===0?'bg-green-50 border-green-200':'bg-blue-50 border-blue-200')}>
                                <div className={'text-xs font-medium mb-1.5 '+(ti===0?'text-green-700':'text-blue-700')}>Team {ti+1}</div>
                                {(courtTeams[team]||[]).map(p=>(
                                  <div key={p.id} className='flex items-center gap-1.5 mb-1 last:mb-0 p-1.5 bg-white rounded border border-border'>
                                    <span className='text-xs font-medium text-dg flex-1'>{p.player_name}</span>
                                    <span className={'text-xs px-1 border rounded '+SC[p.skill_level]}>{SS[p.skill_level]}</span>
                                    <button onClick={()=>donePlayer(p)} className='text-xs px-2 py-0.5 rounded bg-olive text-white font-medium'>Done</button>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ):(
                          <div>
                            <div className='text-xs font-medium text-gray-500 mb-1.5'>On court — tap Done to rotate back to queue</div>
                            {cp.map(p=>(
                              <div key={p.id} className='flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg mb-1.5 last:mb-0'>
                                <div className='flex-1'>
                                  <div className='flex items-center gap-1.5 flex-wrap'>
                                    <span className='text-xs font-medium text-dg'>{p.player_name}</span>
                                    <span className={'text-xs px-1 border rounded '+SC[p.skill_level]}>{SS[p.skill_level]}</span>
                                    {stats[p.id]?.wins>0&&<span className='text-xs text-yellow-600 font-medium'>{stats[p.id].wins}W·{stats[p.id].losses}L</span>}
                                  </div>
                                </div>
                                <button onClick={()=>donePlayer(p)} className='text-xs px-3 py-1.5 rounded-lg bg-olive text-white font-medium whitespace-nowrap'>Done</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {(4-cp.length)>0&&sug.length>0&&(
                      <div>
                        <div className={'text-xs font-medium mb-1.5 flex items-center gap-1 '+'text-olive'}>
                          <i className='ti ti-sparkles'/>
                          {'Next up — longest waiting (' + (4-cp.length) + ' spot' + (4-cp.length!==1?'s':'') + ')'}
                        </div>
                        {(()=>{
                          // Fill the open slots from the ranked, skill-compatible candidate list —
                          // a fixed pair counts as 2 slots, so stop once the remaining room runs
                          // out. Each candidate in `sug` was only checked against the court's
                          // CURRENT occupants (courtSuggestions doesn't know about the other
                          // candidates being offered alongside it), so on an empty or
                          // lightly-filled court a Beginner and an Advanced could both
                          // individually qualify and get listed side by side here even though
                          // assigning both would break the Beginner/Advanced rule the moment the
                          // second one actually joined. Track a running, simulated skill set as
                          // picks are chosen so the batch shown together is one that could really
                          // all be assigned to this court — skipping (not stopping on) a
                          // candidate that would conflict, so a later compatible candidate still
                          // gets a chance to fill the slot.
                          let room=4-cp.length
                          const picks=[]
                          const simSkills=new Set(cp.map(x=>x.skill_level))
                          for(const s of sug){
                            if(s.needed>room)continue
                            const candSkills=s.partner?[s.p.skill_level,s.partner.skill_level]:[s.p.skill_level]
                            const wouldHave=new Set([...simSkills,...candSkills])
                            if(wouldHave.has('beginner')&&wouldHave.has('advanced'))continue
                            picks.push(s)
                            room-=s.needed
                            candSkills.forEach(sk=>simSkills.add(sk))
                            if(room<=0)break
                          }
                          return picks.map(({p,partner},i)=>{
                            const lastDone=mem.lastFinished[p.id]
                            const gs=(stats[p.id]?.wins||0)+(stats[p.id]?.losses||0)
                            return(
                              <div key={p.id} className={'flex items-center gap-2 p-2.5 rounded-lg mb-1.5 last:mb-0 border '+'bg-olive/10 border-olive/30'}>
                                <div className='w-5 h-5 rounded-full bg-white text-xs flex items-center justify-center font-bold text-gray-400 flex-shrink-0'>{i+1}</div>
                                <div className='flex-1'>
                                  <div className='flex items-center gap-1.5 flex-wrap'>
                                    <span className='text-xs font-medium text-dg'>{p.player_name}</span>
                                    <span className={'text-xs px-1 border rounded '+SC[p.skill_level]}>{SS[p.skill_level]}</span>
                                    {gs>0&&<span className='text-xs text-yellow-600'>{stats[p.id]?.wins}W·{stats[p.id]?.losses}L</span>}
                                    {mem.lastResult[p.id]==='win'&&<span title='Won their last game' className='text-xs px-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200'>🏆</span>}
                                    {partner&&<span className='text-xs px-1 rounded bg-purple-100 text-purple-700 flex items-center gap-0.5'><i className='ti ti-link text-xs'/>{partner.player_name}</span>}
                                  </div>
                                  <div className='text-xs text-gray-400'>{lastDone?'Rested '+ago(new Date(lastDone).toISOString()):'Joined '+ago(p.check_in_at)}</div>
                                </div>
                                <button onClick={()=>assign(p,court)} className='text-xs px-3 py-1.5 rounded-lg bg-dg text-white font-medium whitespace-nowrap'>{partner?'Assign Pair':'Assign'}</button>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    )}
                    {cp.length===0&&waiting.length===0&&(<div className='text-center py-4 text-gray-400 text-xs'>Register players above to get started</div>)}
                    {(4-cp.length)>0&&sug.length===0&&waiting.length>0&&(<div className='text-center py-3 text-gray-400 text-xs'>No waiting players fit this court right now (skill level or open slots)</div>)}
                  </div>
                </div>
              )
            })}
            {waiting.length>0&&(
              <div className='bg-white rounded-xl border border-border overflow-hidden'>
                <div className='px-4 py-3 border-b border-border bg-surface flex items-center gap-2'>
                  <i className='ti ti-clock text-olive text-sm'/>
                  <span className='text-sm font-medium text-dg'>Up Next</span>
                  <span className='text-xs text-gray-400'>Recommended players for next rotation</span>
                </div>
                <div className='p-3'>
                  {suggestions.length===0?(<p className='text-xs text-gray-400 text-center py-2'>Not enough players waiting</p>):suggestions.slice(0,4).map((p,i)=>(
                    <div key={p.id} className='flex items-center gap-2 p-1.5 bg-white rounded border border-border mb-1 last:mb-0'>
                      <div className='w-5 h-5 rounded-full bg-olive text-white text-xs flex items-center justify-center font-medium flex-shrink-0'>{i+1}</div>
                      <span className='text-xs font-medium text-dg flex-1'>{p.player_name}</span>
                      <span className={'text-xs px-1 border rounded '+SC[p.skill_level]}>{SS[p.skill_level]}</span>
                      {((stats[p.id]?.wins||0)+(stats[p.id]?.losses||0))>0&&<span className='text-xs text-yellow-600 font-medium'>{(stats[p.id]?.wins||0)+(stats[p.id]?.losses||0)} games</span>}
                      <span className='text-xs text-gray-400'>{mem.lastFinished[p.id]?'Rested '+ago(new Date(mem.lastFinished[p.id]).toISOString()):'Joined '+ago(p.check_in_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab==='lb'&&(
        <div className='p-4 grid grid-cols-1 lg:grid-cols-2 gap-4'>
          <div className='space-y-4'>
            {potw?(
              <div className='bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-300 rounded-xl p-4'>
                <div className='flex items-center gap-2 mb-1'><span>🏆</span><span className='text-xs font-bold text-yellow-700 uppercase tracking-wide'>Player of the Week</span></div>
                <div className='text-xl font-bold text-dg'>{potw.name}</div>
                <div className='text-xs text-gray-600 mt-1'>{potw.wins}W · {potw.losses}L · {wr(potw)}% win rate</div>
                <div className='text-xs text-yellow-700 mt-1 font-medium'>{wr(potw)>=70?'On fire!':wr(potw)>=50?'Consistently strong':'Most active'}</div>
              </div>
            ):(
              <div className='bg-white rounded-xl border border-border p-6 text-center'><div className='text-3xl mb-2'>🏆</div><p className='text-xs text-gray-500'>Record 3+ games to unlock Player of the Week</p></div>
            )}
            <div className='bg-white rounded-xl border border-border p-4'>
              <div className='text-sm font-medium text-dg mb-3'>Rankings</div>
              {ranked.length===0?(
                <p className='text-xs text-gray-400 text-center py-6'>Record game results to build rankings</p>
              ):ranked.slice(0,10).map((p,i)=>(
                <div key={p.id} className={'flex items-center gap-2 p-2 rounded-lg mb-1 '+(i===0?'bg-yellow-50 border border-yellow-200':'bg-surface')}>
                  <div className='text-base w-6 text-center'>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
                  <div className='flex-1 min-w-0'><div className='text-xs font-medium text-dg'>{p.name}</div><div className='text-xs text-gray-400'>{p.wins}W · {p.losses}L · {wr(p)}%</div></div>
                  <div className='text-right'><div className='text-xs font-bold text-dg'>{Math.round(p.score)}pts</div><div className='text-xs text-gray-400'>{(p.wins||0)+(p.losses||0)} games</div></div>
                </div>
              ))}
            </div>
          </div>
          <div className='bg-white rounded-xl border border-border p-4'>
            <div className='text-sm font-medium text-dg mb-3'>Recent games</div>
            {mem.history.length===0?(
              <div className='text-center py-8'><div className='text-3xl mb-2'>🎾</div><p className='text-xs text-gray-400'>No games recorded yet</p></div>
            ):mem.history.slice(-15).reverse().map(g=>(
              <div key={g.id} className='py-2 border-b border-border last:border-0'>
                <div className='flex items-center gap-1 text-xs flex-wrap'>
                  <span className={'font-medium '+(g.winner==='t1'?'text-green-600':'text-gray-400')}>{g.t1?.map(p=>p.name).join(' & ')}</span>
                  <span className='text-gray-300 mx-0.5'>vs</span>
                  <span className={'font-medium '+(g.winner==='t2'?'text-green-600':'text-gray-400')}>{g.t2?.map(p=>p.name).join(' & ')}</span>
                  {g.winner==='draw'&&<span className='text-gray-500 ml-1'>(Draw)</span>}
                </div>
                <div className='text-xs text-gray-400 mt-0.5'>Session {g.sessionNum} · {fmtTime(g.date)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==='history'&&(
        <div className='p-4'>
          <div className='text-sm font-medium text-dg mb-4'>Today's sessions</div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            {mem.sessions.map(s=>(
              <div key={s.num} className='bg-white rounded-xl border border-border p-4'>
                <div className='flex items-center gap-2 mb-3'><span className='text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full font-medium'>Session {s.num} Done</span><span className='text-xs text-gray-400'>{fmtTime(s.start)} - {fmtTime(s.end)}</span></div>
                <div className='grid grid-cols-2 gap-2 mb-2'><div className='bg-surface rounded-lg p-2 text-center'><div className='text-lg font-medium text-dg'>{s.playerCount}</div><div className='text-xs text-gray-400'>Players</div></div><div className='bg-surface rounded-lg p-2 text-center'><div className='text-lg font-medium text-dg'>{s.games}</div><div className='text-xs text-gray-400'>Games</div></div></div>
                <div className='text-xs text-gray-400 leading-relaxed'>{s.players.join(', ')}</div>
              </div>
            ))}
            <div className='bg-green-50 border border-green-200 rounded-xl p-4'>
              <div className='flex items-center gap-2 mb-3'><span className='text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-medium'>Session {sessionNum} Active</span><span className='text-xs text-gray-400'>{fmtTime(sessionStart)}</span></div>
              <div className='grid grid-cols-2 gap-2 mb-2'><div className='bg-white rounded-lg p-2 text-center'><div className='text-lg font-medium text-dg'>{players.length}</div><div className='text-xs text-gray-400'>Players</div></div><div className='bg-white rounded-lg p-2 text-center'><div className='text-lg font-medium text-dg'>{mem.history.filter(g=>g.sessionNum===sessionNum).length}</div><div className='text-xs text-gray-400'>Games</div></div></div>
              <div className='text-xs text-gray-400 leading-relaxed'>{players.map(p=>p.player_name).join(', ')||'No players yet'}</div>
            </div>
          </div>
        </div>
      )}

      {showTeamPicker&&(
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-xl p-5 w-96 border border-border shadow-xl'>
            <h3 className='text-sm font-medium text-dg mb-1'>Set Teams — {showTeamPicker}</h3>
            <p className='text-xs text-gray-500 mb-4'>Tap the swap icon to move a player (or drag, on a mouse). Auto-balanced by skill.</p>
            <div className='grid grid-cols-2 gap-3 mb-4'>
              {['t1','t2'].map((team,ti)=>{
                const other=team==='t1'?'t2':'t1'
                return(
                <div key={team} className={'rounded-lg border p-2 min-h-20 '+(ti===0?'bg-green-50 border-green-200':'bg-blue-50 border-blue-200')} onDragOver={onDragOver} onDrop={e=>onTeamDrop(e,showTeamPicker,team)}>
                  <div className={'text-xs font-medium mb-2 '+(ti===0?'text-green-700':'text-blue-700')}>Team {ti+1}</div>
                  {(teams[showTeamPicker][team]||[]).map(p=>(
                    <div key={p.id} draggable onDragStart={()=>onTeamDragStart(p,team)} className='flex items-center gap-1.5 p-1.5 bg-white rounded border border-border mb-1 last:mb-0 cursor-grab'>
                      <span className='text-xs font-medium text-dg flex-1'>{p.player_name}</span>
                      <span className={'text-xs px-1 border rounded '+SC[p.skill_level]}>{SS[p.skill_level]}</span>
                      <button
                        onClick={()=>setTeams(t=>({...t,[showTeamPicker]:{...t[showTeamPicker],[team]:t[showTeamPicker][team].filter(x=>x.id!==p.id),[other]:[...t[showTeamPicker][other],p]}}))}
                        title={'Move to Team '+(other==='t1'?1:2)}
                        className='text-gray-400 hover:text-dg p-0.5 flex-shrink-0'>
                        <i className='ti ti-arrows-left-right text-xs'/>
                      </button>
                    </div>
                  ))}
                </div>
              )})}
            </div>
            {courts[showTeamPicker].filter(p=>!teams[showTeamPicker].t1.find(x=>x.id===p.id)&&!teams[showTeamPicker].t2.find(x=>x.id===p.id)).length>0&&(
              <div className='mb-3'>
                <div className='text-xs text-gray-500 mb-1'>Unassigned</div>
                {courts[showTeamPicker].filter(p=>!teams[showTeamPicker].t1.find(x=>x.id===p.id)&&!teams[showTeamPicker].t2.find(x=>x.id===p.id)).map(p=>(
                  <div key={p.id} className='flex items-center gap-2 mb-1'>
                    <span className='text-xs text-dg flex-1'>{p.player_name}</span>
                    <button onClick={()=>setTeams(t=>({...t,[showTeamPicker]:{...t[showTeamPicker],t1:[...t[showTeamPicker].t1,p]}}))} className='text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded'>→ T1</button>
                    <button onClick={()=>setTeams(t=>({...t,[showTeamPicker]:{...t[showTeamPicker],t2:[...t[showTeamPicker].t2,p]}}))} className='text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded'>→ T2</button>
                  </div>
                ))}
              </div>
            )}
            <div className='flex gap-2'>
              <button onClick={()=>{const s=suggestTeams(courts[showTeamPicker],pairs);setTeams(t=>({...t,[showTeamPicker]:s}))}} className='flex-1 py-2 rounded-lg border border-border text-xs text-gray-600'>Auto-balance</button>
              <button onClick={()=>setShowTeamPicker(null)} className='flex-1 py-2 rounded-lg bg-dg text-white text-sm font-medium'>Done</button>
            </div>
          </div>
        </div>
      )}

      {showSkillPicker&&(
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-xl p-5 w-72 border border-border shadow-xl text-center'>
            <div className='text-3xl mb-3'>🏓</div>
            <h3 className='text-sm font-medium text-dg mb-1'>Session {sessionNum} Skill Level</h3>
            <p className='text-xs text-gray-500 mb-4'>Who can join this session?</p>
            <div className='space-y-2 mb-4'>
              {[['beginner','BEG Only','Beginners only','bg-green-500'],['intadv','INT + ADV','Intermediate & Advanced','bg-yellow-500'],['all','All Levels','Everyone welcome','bg-dg']].map(([v,label,desc,color])=>(
                <button key={v} onClick={()=>setSessionSkill(v)} className={'w-full py-2.5 rounded-lg border text-left px-3 '+(sessionSkill===v?'border-dg bg-dg/5':'border-border')}>
                  <div className='flex items-center gap-2'>
                    <span className={'text-xs text-white px-2 py-0.5 rounded-full font-medium '+color}>{label}</span>
                    <span className='text-xs text-gray-500'>{desc}</span>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={()=>setShowSkillPicker(false)} className='w-full py-2 rounded-lg bg-dg text-white text-sm font-medium'>Confirm</button>
          </div>
        </div>
      )}

      {rec&&(
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-xl p-5 w-72 border border-border shadow-xl'>
            <h3 className='text-sm font-medium text-dg mb-1'>Record result</h3>
            <p className='text-xs text-gray-500 mb-4'>{rec.court} · Session {sessionNum}</p>
            <div className='grid grid-cols-2 gap-2 mb-4'>
              <div className='bg-green-50 border border-green-200 rounded-lg p-2'>
                <div className='text-xs font-medium text-green-700 mb-1'>Team 1</div>
                {(rec.t1&&rec.t1.length>0?rec.t1:rec.cp.slice(0,2)).map(p=><div key={p.id} className='text-xs text-dg font-medium'>{p.player_name}</div>)}
              </div>
              <div className='bg-blue-50 border border-blue-200 rounded-lg p-2'>
                <div className='text-xs font-medium text-blue-700 mb-1'>Team 2</div>
                {(rec.t2&&rec.t2.length>0?rec.t2:rec.cp.slice(2,4)).map(p=><div key={p.id} className='text-xs text-dg font-medium'>{p.player_name}</div>)}
              </div>
            </div>
            <div className='text-xs font-medium text-gray-500 mb-2'>Who won?</div>
            <div className='grid grid-cols-3 gap-2 mb-4'>
              {[['t1','Team 1'],['draw','Draw'],['t2','Team 2']].map(([v,l])=>(
                <button key={v} onClick={()=>setWinner(v)} className={'py-2 rounded-lg border text-xs font-medium '+(winner===v?'bg-dg text-white border-dg':'border-border text-gray-600')}>{l}</button>
              ))}
            </div>
            <div className='flex gap-2'>
              <button onClick={()=>{setRec(null);setWinner(null)}} className='flex-1 py-2 rounded-lg bg-surface border border-border text-sm text-gray-600'>Cancel</button>
              <button onClick={()=>recordResult((rec.t1&&rec.t1.length>0?rec.t1:rec.cp.slice(0,2)).map(p=>p.id),(rec.t2&&rec.t2.length>0?rec.t2:rec.cp.slice(2,4)).map(p=>p.id),rec.cp)} disabled={!winner} className='flex-1 py-2 rounded-lg bg-dg text-white text-sm font-medium disabled:opacity-40'>Record</button>
            </div>
          </div>
        </div>
      )}
      {confirmNew&&(
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-xl p-5 w-72 border border-border shadow-xl text-center'>
            <div className='text-3xl mb-3'>🏓</div>
            <h3 className='text-sm font-medium text-dg mb-1'>Start Session {sessionNum+1}?</h3>
            <p className='text-xs text-gray-500 mb-1'>Saves Session {sessionNum} and clears all players.</p>
            <p className='text-xs text-orange-600 font-medium mb-4'>Record all results first.</p>
            <div className='flex gap-2'>
              <button onClick={()=>setConfirmNew(false)} className='flex-1 py-2 rounded-lg bg-surface border border-border text-sm text-gray-600'>Cancel</button>
              <button onClick={()=>endSession(true)} className='flex-1 py-2 rounded-lg bg-olive text-white text-sm font-medium'>Start Session {sessionNum+1}</button>
            </div>
          </div>
        </div>
      )}
      {confirmReset&&(
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-xl p-5 w-72 border border-border shadow-xl text-center'>
            <div className='text-3xl mb-3'>⚠️</div>
            <h3 className='text-sm font-medium text-dg mb-1'>Reset Session {sessionNum}?</h3>
            <p className='text-xs text-gray-500 mb-1'>Clears all players. Game history is kept.</p>
            <p className='text-xs text-red-600 font-medium mb-4'>Cannot be undone.</p>
            <div className='flex gap-2'>
              <button onClick={()=>setConfirmReset(false)} className='flex-1 py-2 rounded-lg bg-surface border border-border text-sm text-gray-600'>Cancel</button>
              <button onClick={()=>endSession(false)} className='flex-1 py-2 rounded-lg bg-maroon text-white text-sm font-medium'>Reset</button>
            </div>
          </div>
        </div>
      )}
      {pairPickerFor&&(
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-xl p-5 w-72 border border-border shadow-xl'>
            <h3 className='text-sm font-medium text-dg mb-1'>Set fixed partner</h3>
            <p className='text-xs text-gray-500 mb-4'>{pairPickerFor.player_name} will always be assigned to a court together with their partner, as a team.</p>
            <div className='max-h-64 overflow-y-auto space-y-1 mb-4'>
              {waiting.filter(w=>w.id!==pairPickerFor.id&&!partnerIdOf(w.id)&&skillPairOk(w.skill_level,pairPickerFor.skill_level)).length===0?(
                <p className='text-xs text-gray-400 text-center py-3'>No other unpaired, skill-compatible players waiting</p>
              ):waiting.filter(w=>w.id!==pairPickerFor.id&&!partnerIdOf(w.id)&&skillPairOk(w.skill_level,pairPickerFor.skill_level)).map(w=>(
                <button key={w.id} onClick={()=>makePair(pairPickerFor.id,w.id)} className='w-full flex items-center gap-2 p-2 rounded-lg border border-border hover:border-olive hover:bg-olive/5 text-left'>
                  <span className='text-xs font-medium text-dg flex-1'>{w.player_name}</span>
                  <span className={'text-xs px-1 border rounded '+SC[w.skill_level]}>{SS[w.skill_level]}</span>
                </button>
              ))}
            </div>
            <button onClick={()=>setPairPickerFor(null)} className='w-full py-2 rounded-lg bg-surface border border-border text-sm text-gray-600'>Cancel</button>
          </div>
        </div>
      )}
      {removing&&(
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-xl p-5 w-64 border border-border shadow-xl text-center'>
            <div className='text-2xl mb-2'>👋</div>
            <h3 className='text-sm font-medium text-dg mb-1'>Remove {removing.player_name}?</h3>
            <p className='text-xs text-gray-500 mb-4'>They leave this session.</p>
            <div className='flex gap-2'>
              <button onClick={()=>setRemoving(null)} className='flex-1 py-2 rounded-lg bg-surface border border-border text-sm text-gray-600'>Cancel</button>
              <button onClick={()=>removePlayer(removing)} className='flex-1 py-2 rounded-lg bg-maroon text-white text-sm font-medium'>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
