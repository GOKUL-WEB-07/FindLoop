import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query'; import {getProfile,updateProfile} from '../services/profile';
export function useProfile(){return useQuery({queryKey:['profile'],queryFn:getProfile});}
export function useUpdateProfile(){const q=useQueryClient();return useMutation({mutationFn:updateProfile,onSuccess:()=>{q.invalidateQueries({queryKey:['profile']});q.invalidateQueries({queryKey:['items']});q.invalidateQueries({queryKey:['item']});q.invalidateQueries({queryKey:['my-lending']})}});}
