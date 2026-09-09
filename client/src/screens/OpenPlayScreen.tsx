import { useState, useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'

const SC={beginner:'bg-green-100 text-green-700 border-green-200',intermediate:'bg-yellow-100 text-yellow-700 border-yellow-200',advanced:'bg-red-100 text-red-700 border-red-200'}
const SS={beginner:'BEG',intermediate:'INT',advanced:'ADV'}
const SKILL_ORDER={beginner:1,intermediate:2,advanced:3}

function loadMem(){try{const s=localStorage.getItem('op_mem');return s?JSON.parse(s):{sessions:[],currentSession:1,stats:{},history:[],removed:{},lastFinished:{},recentOpponents:{}}}catch{return{sessions:[],currentSession:1,stats:{},history:[],removed:{},lastFinished:{},recentOpponents:{}}}}
function saveMem(){try{localStorage.setItem('op_mem',JSON.stringify(mem))}catch{}}
const mem=loadMem()

function ago(iso){const m=Math.floor((Date.now()-new Date(iso).getTime())/60000);return m<1?'just now':m<60?m+'m ago':Math.floor(m/60)+'h '+(m%60?m%60+'m':'')}
function wr(s){const g=(s.wins||0)+(s.losses||0);return g?Math.round((s.wins||0)/g*100):0}
function fmtTime(iso){return new Date(iso).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}
function elapsed(iso){return iso?Math.floor((Date.now()-new Date(iso).getTime())/60000):0}

function getSuggestions(waiting,stats){
  const now=Date.now()
  const sorted=[...waiting].sort((a,b)=>{
    const aTime=mem.lastFinished[a.id]||new Date(a.check_in_at).getTime()
    const bTime=mem.lastFinished[b.id]||new Date(b.check_in_at).getTime()
    const aWait=now-aTime
    const bWait=now-bTime
    // Players with fewer total games get priority bonus
    const aGames=(stats[a.id]?.wins||0)+(stats[a.id]?.losses||0)+(stats[a.id]?.draws||0)
    const bGames=(stats[b.id]?.wins||0)+(stats[b.id]?.losses||0)+(stats[b.id]?.draws||0)
    const aGamePenalty=aGames*60000 // each game adds 1min penalty
    const bGamePenalty=bGames*60000
    return (bWait-bGamePenalty)-(aWait-aGamePenalty)
  })
  return sorted.slice(0,4)
}

function suggestTeams(players){
  const sorted=[...players].sort((a,b)=>(SKILL_ORDER[b.skill_level]||1)-(SKILL_ORDER[a.skill_level]||1))
  return{t1:[sorted[0],sorted[3]].filter(Boolean),t2:[sorted[1],sorted[2]].filter(Boolean)}
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
  const waiting=players.filter(p=>!onCourtIds.has(p.id)&&!mem.removed[p.id])
  const onCourt=courts['Court 1'].length+courts['Court 2'].length
  const suggestions=getSuggestions(waiting,stats)
  const sortedWaiting=[...waiting].sort((a,b)=>{
    const _now=Date.now()
    const aL=mem.lastFinished[a.id]||new Date(a.check_in_at).getTime()
    const bL=mem.lastFinished[b.id]||new Date(b.check_in_at).getTime()
    return(_now-bL)-(_now-aL)
  })
  const allowedSkills=sessionSkill==='beginner'?['beginner']:sessionSkill==='intadv'?['intermediate','advanced']:['beginner','intermediate','advanced']

  async function register(){
    if(!name.trim()||!session)return
    if(!allowedSkills.includes(skill))return
    const r=await window.electronAPI.registerOpenPlay({branch_id:session.branch_id,player_name:name.trim(),skill_level:skill,play_date:new Date().toISOString().slice(0,10),court_assigned:undefined,transaction_id:undefined})
    setPlayers(p=>{const n=[...p,r];localStorage.setItem('op_players',JSON.stringify(n));return n});setName('')
  }

  async function assign(player,court){
    const key=court==='Court 1'?'court_1':'court_2'
    await window.electronAPI.assignCourt(player.id,key)
    const existing=courts[court]
    existing.forEach(cp=>{
      mem.recentOpponents[player.id]=[...(mem.recentOpponents[player.id]||[]),cp.id].slice(-12)
      mem.recentOpponents[cp.id]=[...(mem.recentOpponents[cp.id]||[]),player.id].slice(-12)
    })
    const now=new Date().toISOString()
    setPlayers(p=>{const n=p.map(x=>x.id===player.id?{...x,court_assigned:key,checked_out_at:null}:x);localStorage.setItem('op_players',JSON.stringify(n));return n})
    setCourts(c=>{
      const updated={...c,[court]:[...c[court],{...player,court_assigned:key,checked_out_at:null,court_start_time:now}]}
      if(updated[court].length===4){const suggested=suggestTeams(updated[court]);setTeams(t=>({...t,[court]:suggested}))}
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
    setRemoving(null)
  }

  function endSession(startNew){
    mem.sessions.push({num:sessionNum,start:sessionStart,end:new Date().toISOString(),playerCount:players.length,players:players.map(p=>p.player_name),games:mem.history.filter(g=>g.sessionNum===sessionNum).length})
    mem.removed={};mem.lastFinished={};mem.recentOpponents={};saveMem();saveMem()
    if(startNew){const next=sessionNum+1;mem.currentSession=next;setSessionNum(next);setSessionStart(new Date().toISOString())}
    setPlayers([]);setCourts({'Court 1':[],'Court 2':[]})
    localStorage.setItem('op_players','[]');localStorage.setItem('op_courts',JSON.stringify({'Court 1':[],'Court 2':[]}))
    setRec(null);setConfirmReset(false);setConfirmNew(false);setShowSkillPicker(true)
  }

  function recordResult(t1ids,t2ids){
    if(!winner)return
    const ns={...stats}
    ;[...t1ids,...t2ids].forEach(id=>{if(!ns[id])ns[id]={wins:0,losses:0,draws:0,name:players.find(p=>p.id===id)?.player_name||'?'}})
    t1ids.forEach(id=>{mem.recentOpponents[id]=[...(mem.recentOpponents[id]||[]),...t2ids].slice(-12)})
    t2ids.forEach(id=>{mem.recentOpponents[id]=[...(mem.recentOpponents[id]||[]),...t1ids].slice(-12)})
    if(winner==='draw'){[...t1ids,...t2ids].forEach(id=>{ns[id].draws=(ns[id].draws||0)+1})}
    else{const w=winner==='t1'?t1ids:t2ids;const l=winner==='t1'?t2ids:t1ids;w.forEach(id=>{ns[id].wins=(ns[id].wins||0)+1});l.forEach(id=>{ns[id].losses=(ns[id].losses||0)+1})}
    mem.history.push({id:Date.now(),date:new Date().toISOString(),sessionNum,t1:t1ids.map(id=>({id,name:ns[id]?.name})),t2:t2ids.map(id=>({id,name:ns[id]?.name})),winner})
    mem.stats=ns;setStats(ns);setRec(null);setWinner(null);saveMem();saveMem()
  }

  function onDragStart(p){setDragPlayer(p)}
  function onDragOver(e){e.preventDefault()}
  function onDropCourt(e,court){
    e.preventDefault()
    if(!dragPlayer)return
    if(courts[court].length>=4)return
    if(onCourtIds.has(dragPlayer.id))return
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
                    {/* Tap-to-assign — HTML5 drag doesn't work via touch on iPad, so this is the primary way to assign on tablet. */}
                    <div className='flex items-center gap-1 mr-1'>
                      <button onClick={()=>assign(p,'Court 1')} disabled={courts['Court 1'].length>=4} title='Assign to Court 1'
                        className='text-xs px-1.5 py-1 rounded-md bg-dg/10 text-dg font-medium hover:bg-dg/20 disabled:opacity-30 disabled:cursor-not-allowed'>C1</button>
                      <button onClick={()=>assign(p,'Court 2')} disabled={courts['Court 2'].length>=4} title='Assign to Court 2'
                        className='text-xs px-1.5 py-1 rounded-md bg-dg/10 text-dg font-medium hover:bg-dg/20 disabled:opacity-30 disabled:cursor-not-allowed'>C2</button>
                    </div>
                    <button onClick={()=>setRemoving(p)} className='text-gray-300 hover:text-red-400 text-xs p-0.5'><i className='ti ti-x'/></button>
                  </div>
                )
              })}
            </div>
          </div>
          <div className='lg:col-span-2 space-y-4'>
            <div className='bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700'>
              <strong>Fair rotation:</strong> Tap C1/C2 (or drag, on a mouse) to assign a waiting player. Game stops only when YOU tap Done.
            </div>
            {['Court 1','Court 2'].map(court=>{
              const cp=courts[court]
              const sug=suggestions
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
                        {sug.slice(0,4-cp.length).map((p,i)=>{
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
                                </div>
                                <div className='text-xs text-gray-400'>{lastDone?'Rested '+ago(new Date(lastDone).toISOString()):'Joined '+ago(p.check_in_at)}</div>
                              </div>
                              <button onClick={()=>assign(p,court)} className='text-xs px-3 py-1.5 rounded-lg bg-dg text-white font-medium whitespace-nowrap'>Assign</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {cp.length===0&&waiting.length===0&&(<div className='text-center py-4 text-gray-400 text-xs'>Register players above to get started</div>)}
                    {(4-cp.length)>0&&sug.length===0&&waiting.length>0&&(<div className='text-center py-3 text-gray-400 text-xs'>All waiting players already suggested</div>)}
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
              <button onClick={()=>{const s=suggestTeams(courts[showTeamPicker]);setTeams(t=>({...t,[showTeamPicker]:s}))}} className='flex-1 py-2 rounded-lg border border-border text-xs text-gray-600'>Auto-balance</button>
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
              <button onClick={()=>recordResult((rec.t1&&rec.t1.length>0?rec.t1:rec.cp.slice(0,2)).map(p=>p.id),(rec.t2&&rec.t2.length>0?rec.t2:rec.cp.slice(2,4)).map(p=>p.id))} disabled={!winner} className='flex-1 py-2 rounded-lg bg-dg text-white text-sm font-medium disabled:opacity-40'>Record</button>
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
