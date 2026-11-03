import MafiaGame from '../../game-client';
export const metadata = {title:'دعوة لقعدة مافيا',robots:{index:false,follow:false}};
export default async function JoinPage({params}:{params:Promise<{code:string}>}) {
  const {code}=await params;
  return <MafiaGame inviteCode={code}/>;
}
