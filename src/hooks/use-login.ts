import { useQuery } from "@tanstack/react-query"
import { fetchLoginUser } from "@/lib/nezha-api"

export function useLogin() {
  const {
    data: userData,
    isError,
  } = useQuery({
    queryKey: ["login-user"],
    queryFn: () => fetchLoginUser(),
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: true,
    refetchInterval: 1000 * 30,
    retry: 0,
  })

  const isLogin = isError ? false : userData ? !!userData?.data?.id && !!document.cookie : false

  return { isLogin }
} 